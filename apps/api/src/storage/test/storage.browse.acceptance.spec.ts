import {INestApplication, NestApplicationOptions} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {StorageModule} from "@spica-server/storage";
import {Binary, serialize} from "bson";

describe("Storage Browse Acceptance", () => {
  let app: INestApplication;
  let req: Request;
  let module: any;

  const urlRegex = /http:\/\/insteadof\/storage\/.*?\/view/;

  async function initModule(options: NestApplicationOptions = {}) {
    module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.standalone(),
        StorageModule.forRoot({
          defaultPath: process.env.TEST_TMPDIR,
          defaultPublicUrl: "http://insteadof",
          strategy: "default",
          objectSizeLimit: 0.1,
          resumableUploadExpiresIn: 1000 * 60 // 1 minute
        })
      ]
    }).compile();

    app = module.createNestApplication(options);
    req = module.get(Request);
    await app.listen(req.socket);

    await new Promise((resolve, _) => setTimeout(resolve, 1000));
  }

  async function addHierarchicalObjects() {
    const objects = [
      // Root level files (flat names)
      {
        name: "root-file1.txt",
        content: {
          data: new Binary(Buffer.from("root1")),
          type: "text/plain"
        }
      },
      {
        name: "root-file2.txt",
        content: {
          data: new Binary(Buffer.from("root2")),
          type: "text/plain"
        }
      },
      // Photos directory structure (using underscores instead of slashes for now)
      {
        name: "photos_vacation1.jpg",
        content: {
          data: new Binary(Buffer.from("photo1")),
          type: "image/jpeg"
        }
      },
      {
        name: "photos_vacation2.jpg",
        content: {
          data: new Binary(Buffer.from("photo2")),
          type: "image/jpeg"
        }
      },
      {
        name: "photos_family.jpg",
        content: {
          data: new Binary(Buffer.from("family")),
          type: "image/jpeg"
        }
      }
    ];

    // Create the objects with flat names first
    const result = await req.post("/storage", serialize({content: objects}), {
      "Content-Type": "application/bson"
    });

    if (result.statusCode === 201) {
      const {DatabaseService} = await import("@spica-server/database");
      const db = module.get(DatabaseService);
      const collection = db.collection("storage");

      await collection.updateOne(
        {name: "photos_vacation1.jpg"},
        {$set: {name: "photos/vacation1.jpg"}}
      );
      await collection.updateOne(
        {name: "photos_vacation2.jpg"},
        {$set: {name: "photos/vacation2.jpg"}}
      );
      await collection.updateOne({name: "photos_family.jpg"}, {$set: {name: "photos/family.jpg"}});

      await collection.insertMany([
        {
          name: "photos/dogs/buddy.jpg",
          content: {
            type: "image/jpeg",
            size: 4
          }
        },
        {
          name: "photos/dogs/max.jpg",
          content: {
            type: "image/jpeg",
            size: 4
          }
        },
        {
          name: "photos/cats/whiskers.jpg",
          content: {
            type: "image/jpeg",
            size: 4
          }
        },
        {
          name: "documents/report.pdf",
          content: {
            type: "application/pdf",
            size: 6
          }
        }
      ]);
    }

    return result;
  }

  beforeEach(async () => {
    await initModule({bodyParser: false});

    await addHierarchicalObjects();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("path browsing", () => {
    it("should browse root directory (empty path)", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "",
        paginate: false,
        sort: JSON.stringify({name: 1})
      });

      const names = body.map(obj => obj.name);
      expect(names).toEqual(["root-file1.txt", "root-file2.txt"]);
    });

    it("should browse photos directory (first level only)", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        paginate: false,
        sort: JSON.stringify({name: 1})
      });

      const names = body.map(obj => obj.name);
      expect(names).toEqual(["photos/family.jpg", "photos/vacation1.jpg", "photos/vacation2.jpg"]);
    });

    it("should browse photos/dogs directory", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos/dogs",
        paginate: false,
        sort: JSON.stringify({name: 1})
      });

      const names = body.map(obj => obj.name);
      expect(names).toEqual(["photos/dogs/buddy.jpg", "photos/dogs/max.jpg"]);
    });

    it("should handle path with leading/trailing slashes", async () => {
      const {body: body1} = await req.get("/storage/browse", {
        path: "/photos/",
        paginate: false,
        sort: JSON.stringify({name: 1})
      });

      const {body: body2} = await req.get("/storage/browse", {
        path: "photos",
        paginate: false,
        sort: JSON.stringify({name: 1})
      });

      expect(body1.map(obj => obj.name)).toEqual(body2.map(obj => obj.name));
    });

    it("should return empty array for non-existent path", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "nonexistent",
        paginate: false
      });

      expect(body).toEqual([]);
    });
  });

  describe("pagination", () => {
    it("should work with paginate=true", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        paginate: true,
        limit: "2",
        sort: JSON.stringify({name: 1})
      });

      expect(body.meta.total).toBe(3);
      expect(body.data.length).toBe(2);
      expect(body.data[0].name).toBe("photos/family.jpg");
      expect(body.data[1].name).toBe("photos/vacation1.jpg");
    });

    it("should work with paginate=false", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        paginate: false,
        limit: "2",
        sort: JSON.stringify({name: 1})
      });

      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body[0].name).toBe("photos/family.jpg");
      expect(body[1].name).toBe("photos/vacation1.jpg");
    });

    it("should work with skip", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        paginate: false,
        skip: "1",
        sort: JSON.stringify({name: 1})
      });

      expect(body.length).toBe(2);
      expect(body[0].name).toBe("photos/vacation1.jpg");
      expect(body[1].name).toBe("photos/vacation2.jpg");
    });

    it("should work with limit and skip combined", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        paginate: false,
        limit: "1",
        skip: "1",
        sort: JSON.stringify({name: 1})
      });

      expect(body.length).toBe(1);
      expect(body[0].name).toBe("photos/vacation1.jpg");
    });
  });

  describe("sorting", () => {
    it("should sort ascending by name", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        paginate: false,
        sort: JSON.stringify({name: 1})
      });

      const names = body.map(obj => obj.name);
      expect(names).toEqual(["photos/family.jpg", "photos/vacation1.jpg", "photos/vacation2.jpg"]);
    });

    it("should sort descending by name", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        paginate: false,
        sort: JSON.stringify({name: -1})
      });

      const names = body.map(obj => obj.name);
      expect(names).toEqual(["photos/vacation2.jpg", "photos/vacation1.jpg", "photos/family.jpg"]);
    });
  });

  describe("filtering", () => {
    it("should filter by content type", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        filter: JSON.stringify({"content.type": "image/jpeg"}),
        paginate: false,
        sort: JSON.stringify({name: 1})
      });

      const names = body.map(obj => obj.name);
      expect(names).toEqual(["photos/family.jpg", "photos/vacation1.jpg", "photos/vacation2.jpg"]);
      body.forEach(obj => {
        expect(obj.content.type).toBe("image/jpeg");
      });
    });

    it("should filter by name pattern", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        filter: JSON.stringify({name: {$regex: "vacation"}}),
        paginate: false,
        sort: JSON.stringify({name: 1})
      });

      const names = body.map(obj => obj.name);
      expect(names).toEqual(["photos/vacation1.jpg", "photos/vacation2.jpg"]);
    });

    it("should combine filter with browse path", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        filter: JSON.stringify({name: {$regex: "family"}}),
        paginate: false
      });

      expect(body.length).toBe(1);
      expect(body[0].name).toBe("photos/family.jpg");
    });
  });

  describe("URL attachment", () => {
    it("should attach URLs to all returned objects", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        paginate: false
      });

      expect(body.length).toBeGreaterThan(0);
      body.forEach(obj => {
        expect(obj.url).toBeDefined();
        expect(typeof obj.url).toBe("string");
        expect(urlRegex.test(obj.url)).toBe(true);
      });
    });

    it("should attach URLs when paginated", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        paginate: true
      });

      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach(obj => {
        expect(obj.url).toBeDefined();
        expect(typeof obj.url).toBe("string");
        expect(urlRegex.test(obj.url)).toBe(true);
      });
    });
  });

  describe("combined operations", () => {
    it("should combine path, filter, sort, limit, and skip", async () => {
      const {body} = await req.get("/storage/browse", {
        path: "photos",
        filter: JSON.stringify({name: {$regex: "vacation"}}),
        sort: JSON.stringify({name: -1}),
        limit: "1",
        skip: "0",
        paginate: true
      });

      expect(body.data.length).toBe(1);
      expect(body.data[0].name).toBe("photos/vacation2.jpg");
      expect(body.meta.total).toBe(2);
    });
  });
});
