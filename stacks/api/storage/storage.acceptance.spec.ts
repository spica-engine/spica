import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {Middlewares} from "@spica-server/core";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, DatabaseService} from "@spica-server/database/testing";
import * as BSON from "bson";
import {StorageModule} from "./storage.module";
import {PassportTestingModule} from "@spica-server/passport/testing";

describe("Storage acceptance test", () => {
  async function addRandomData(count: number) {
    const storageObjects = new Array(count).fill(undefined).map((_, index) => {
      return {
        name: `name${index + 1}`,
        content: {
          data: new BSON.Binary(Buffer.from((index + 1).toString())),
          type: `type${index + 1}`
        }
      };
    });

    return await req.post("/storage", BSON.serialize(storageObjects), {
      "Content-Type": "application/bson"
    });
  }

  let app: INestApplication;
  let req: Request;
  let module;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.create(),
        StorageModule.forRoot({path: "/tmp"})
      ]
    }).compile();
    app = module.createNestApplication();
    app.use(Middlewares.BsonBodyParser);
    req = module.get(Request);
    await app.listen(req.socket);
  });

  describe("getAll requests", () => {
    beforeAll(async () => {
      await addRandomData(20);
    });
    afterAll(async () => {
      await app.get(DatabaseService).dropCollection("storage");
    });
    it("should get 10 storage objects if there is no limit ", async () => {
      const response = await req.get("/storage", {});
      expect(response.body.meta.total).toEqual(20);

      const objects = response.body.data;
      expect(objects.length).toEqual(10);
      objects.map((value, index) => {
        expect(value._id).toBeDefined();
        expect(value.name).toEqual(`name${objects.length - index}`);
        expect(value.url).toBeDefined();
      });
    });
    it("should work with limit query", async () => {
      const response = await req.get("/storage", {limit: "5"});
      expect(response.body.meta.total).toEqual(20);

      const objects = response.body.data;
      expect(objects.length).toEqual(5);
      objects.map((value, index) => {
        expect(value._id).toBeDefined();
        expect(value.name).toEqual(`name${objects.length - index}`);
        expect(value.url).toBeDefined();
      });
    });
    it("should work with skip query", async () => {
      const response = await req.get("/storage", {skip: "3"});
      expect(response.body.meta.total).toEqual(20);

      const objects = response.body.data;
      expect(objects.length).toEqual(10, "should work because default limit number is 10");
      objects.map((value, index) => {
        expect(value._id).toBeDefined();
        expect(value.name).toEqual(`name${objects.length + 3 - index}`);
        expect(value.url).toBeDefined();
      });
    });
    it("should work with skip and limit query", async () => {
      const response = await req.get("/storage", {limit: "15", skip: "3"});
      expect(response.body.meta.total).toEqual(20);

      const objects = response.body.data;
      expect(objects.length).toEqual(15);
      objects.map((value, index) => {
        expect(value._id).toBeDefined();
        expect(value.name).toEqual(`name${objects.length + 3 - index}`);
        expect(value.url).toBeDefined();
      });
    });

    describe("sorts", () => {
      it("ascend by name", async () => {
        const response = await req.get("/storage", {
          limit: "5",
          skip: "3",
          sort: JSON.stringify({name: 1})
        });
        expect(response.body.meta.total).toEqual(20);

        const objects = response.body.data;
        expect(objects.length).toEqual(5);
        objects.map((value, index) => {
          expect(value._id).toBeDefined();
          expect(value.name).toEqual(`name${index + 1 + 3}`);
          expect(value.url).toBeDefined();
        });
      });
      it("descend by name", async () => {
        const response = await req.get("/storage", {
          limit: "5",
          skip: "3",
          sort: JSON.stringify({name: -1})
        });
        expect(response.body.meta.total).toEqual(20);

        const objects = response.body.data;
        expect(objects.length).toEqual(5);
        objects.map((value, index) => {
          expect(value._id).toBeDefined();
          expect(value.name).toEqual(`name${objects.length + 3 - index}`);
          expect(value.url).toBeDefined();
        });
      });
      it("ascend by date", async () => {
        const response = await req.get("/storage", {
          limit: "5",
          skip: "3",
          sort: JSON.stringify({_id: 1})
        });
        expect(response.body.meta.total).toEqual(20);

        const objects = response.body.data;
        expect(objects.length).toEqual(5);
        objects.map((value, index) => {
          expect(value._id).toBeDefined();
          expect(value.name).toEqual(`name${index + 1 + 3}`);
          expect(value.url).toBeDefined();
        });
      });
      it("descend by date", async () => {
        const response = await req.get("/storage", {
          limit: "5",
          skip: "3",
          sort: JSON.stringify({name: -1})
        });
        expect(response.body.meta.total).toEqual(20);

        const objects = response.body.data;
        expect(objects.length).toEqual(5);
        objects.map((value, index) => {
          expect(value._id).toBeDefined();
          expect(value.name).toEqual(`name${objects.length + 3 - index}`);
          expect(value.url).toBeDefined();
        });
      });
    });
  });

  describe("get requests", () => {
    beforeAll(async () => {
      await addRandomData(20);
    });
    afterAll(async () => {
      await app.get(DatabaseService).dropCollection("storage");
    });
    it("should get storage object withMeta true", async () => {
      const selectedData = (await req.get("/storage", {})).body.data[5];
      const responseData = (await req.get(`/storage/${selectedData._id}`, {withMeta: "true"})).body;
      expect(responseData._id).toEqual(selectedData._id);
      expect(responseData.url).toEqual(selectedData.url);
      expect(responseData.name).toEqual(selectedData.name);
    });

    it("should get storage object withMeta false", async () => {
      const selectedData = (await req.get("/storage", {})).body.data[5];
      const response = await req.get(`/storage/${selectedData._id}`, {withMeta: "false"});
      expect(response.headers["content-type"]).toEqual("type5");
      expect(response.body).toEqual(5);
    });
  });

  describe("put requests", () => {
    beforeAll(async () => {
      await addRandomData(20);
    });
    afterAll(async () => {
      await app.get(DatabaseService).dropCollection("storage");
    });
    it("should show updated storage object", async () => {
      let selectedData = (await req.get("/storage", {})).body.data[5];
      selectedData.content.data = new BSON.Binary(Buffer.from("new data"));

      await req.put("/storage", BSON.serialize(selectedData), {
        "Content-Type": "application/bson"
      });
      expect((await req.get(`/storage/${selectedData._id}`, {withMeta: "false"})).body).toEqual(
        "new data"
      );
    });

    it("should throw error if updated data is empty", async () => {
      let selectedData = (await req.get("/storage", {})).body.data[3];
      selectedData.content.data = null;
      const response = await req.put("/storage", BSON.serialize(selectedData), {
        "Content-Type": "application/bson"
      });

      expect(response.statusCode).toEqual(400);
      expect(response.statusText).toEqual("Bad Request");

      expect((await req.get(`/storage/${selectedData._id}`, {withMeta: "false"})).body).toEqual(7);
    });
  });

  describe("post requests", () => {
    afterEach(async () => {
      (await app
        .get(DatabaseService)
        .collection("storage")
        .count()) != 0 && (await app.get(DatabaseService).dropCollection("storage"));
    });

    it("should insert single storage object", async () => {
      const newData = {
        name: "new name",
        content: {
          data: new BSON.Binary(Buffer.from("new data")),
          type: "new type"
        }
      };
      const response = await req.post("/storage", BSON.serialize([newData]), {
        "Content-Type": "application/bson"
      });

      expect(response.statusCode).toBe(201);
      expect(response.statusText).toBe("Created");

      const insertedData = (await req.get("/storage", {})).body;
      expect(insertedData.meta.total).toEqual(1);
      expect(insertedData.data.length).toEqual(1);
      expect(insertedData.data[0].name).toEqual("new name");
      expect(insertedData.data[0].url).toBeDefined();
      expect(insertedData.data[0]._id).toBeDefined();
      expect(insertedData.data[0].content.type).toEqual("new type");
      expect(insertedData.data[0].content.size).toEqual(Buffer.from("new data").byteLength);
    });

    it("should insert storage objects", async () => {
      const newData = [
        {
          name: "new name1",
          content: {
            data: new BSON.Binary(Buffer.from("new data1")),
            type: "new type1"
          }
        },
        {
          name: "new name2",
          content: {
            data: new BSON.Binary(Buffer.from("new data2")),
            type: "new type2"
          }
        }
      ];
      const response = await req.post("/storage", BSON.serialize(newData), {
        "Content-Type": "application/bson"
      });

      expect(response.statusCode).toBe(201);
      expect(response.statusText).toBe("Created");

      const insertedData = (await req.get("/storage", {})).body;
      expect(insertedData.meta.total).toEqual(2);
      expect(insertedData.data.length).toEqual(2);
      insertedData.data.map((val, index) => {
        expect(val.name).toEqual(`new name${insertedData.data.length - index}`);
        expect(val.url).toBeDefined();
        expect(val._id).toBeDefined();
        expect(val.content.type).toEqual(`new type${insertedData.data.length - index}`);
        expect(val.content.size).toEqual(
          Buffer.from(`new name${insertedData.data.length - index}`).byteLength
        );
      });
    });

    it("should throw error if inserted object data is empty", async () => {
      const newData = [
        {
          name: "new name1",
          content: {
            data: null,
            type: "new type1"
          }
        },
        {
          name: "new name2",
          content: {
            data: new BSON.Binary(Buffer.from("new data2")),
            type: "new type2"
          }
        }
      ];
      const response = await req.post("/storage", BSON.serialize(newData), {
        "Content-Type": "application/bson"
      });

      expect(response.statusCode).toBe(400);
      expect(response.statusText).toBe("Bad Request");

      const storageObjects = (await req.get("/storage", {})).body;
      expect(storageObjects.data.length).toBe(0);
      expect(storageObjects.data).toEqual([]);
    });
  });

  describe("delete requests", () => {
    beforeEach(async () => {
      await addRandomData(10);
    });
    afterEach(async () => {
      await app.get(DatabaseService).dropCollection("storage");
    });

    it("should detele storage object", async () => {
      const storageObjectId = (await req.get("/storage", {})).body.data[3]._id;

      const response = await req.delete(`/storage/${storageObjectId}`);
      expect(response.statusCode).toBe(200);
      expect(response.statusText).toBe("OK");

      const storageObjects = (await req.get("/storage", {})).body;
      expect(storageObjects.meta.total).toBe(9);
      expect(storageObjects.data.length).toEqual(9);

      const deletedStorageObjectResponse = await req.get(`/storage${storageObjectId}`, {});
      expect(deletedStorageObjectResponse.statusCode).toBe(404);
      expect(deletedStorageObjectResponse.statusText).toBe("Not Found");
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
