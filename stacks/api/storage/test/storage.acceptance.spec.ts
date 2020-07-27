import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {StorageModule} from "@spica-server/storage";
import * as BSON from "bson";
import * as etag from "etag";
import {StorageObject} from "../src/body";

describe("Storage Acceptance", () => {
  let app: INestApplication;
  let req: Request;

  async function addTextObjects(count: number) {
    const objects = new Array(count).fill(undefined).map((_, index) => {
      return {
        name: `name ${index + 1}.txt`,
        content: {
          data: new BSON.Binary(Buffer.from(`content ${index + 1}`)),
          type: `text/plain`
        }
      };
    });

    return await req.post("/storage", BSON.serialize({content: objects}), {
      "Content-Type": "application/bson"
    });
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.standalone(),
        StorageModule.forRoot({
          defaultPath: process.env.TEST_TMPDIR,
          defaultPublicUrl: "http://insteadof",
          strategy: "default",
          objectSizeLimit: 0.1
        })
      ]
    }).compile();
    app = module.createNestApplication(undefined, {
      bodyParser: false
    });
    req = module.get(Request);
    await app.listen(req.socket);
    await addTextObjects(20);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
      if (expected == "__skip_if_valid_url__" && typeof actual == typeof expected) {
        return /http:\/\/insteadof\/storage\/.*?\/view/.test(actual);
      }
      return undefined;
    });
  });

  describe("index", () => {
    it("should work with limit", async () => {
      const {
        body: {meta, data}
      } = await req.get("/storage", {limit: "2"});
      expect(meta.total).toBe(20);
      expect(data.length).toBe(2);

      for (const [index, object] of data.entries()) {
        expect(object._id).toBeDefined();
        expect(object.name).toBe(`name ${data.length - index}.txt`);
        expect(object.url).toBe(`http://insteadof/storage/${object._id}/view`);
      }
    });

    it("should work with skip query", async () => {
      const {
        body: {meta, data}
      } = await req.get("/storage", {skip: "3"});
      expect(meta.total).toBe(20);
      expect(data.length).toBe(17);

      for (const [index, object] of data.entries()) {
        expect(object._id).toBeDefined();
        expect(object.name).toBe(`name ${data.length + 3 - index}.txt`);
        expect(object.url).toBe(`http://insteadof/storage/${object._id}/view`);
      }
    });

    it("should work with skip and limit query", async () => {
      const {
        body: {meta, data}
      } = await req.get("/storage", {skip: "3", limit: "15"});
      expect(meta.total).toBe(20);
      expect(data.length).toBe(15);

      for (const [index, object] of data.entries()) {
        expect(object._id).toBeDefined();
        expect(object.name).toBe(`name ${data.length + 3 - index}.txt`);
        expect(object.url).toBe(`http://insteadof/storage/${object._id}/view`);
      }
    });

    describe("sort", () => {
      it("ascend by name", async () => {
        const {
          body: {meta, data}
        } = await req.get("/storage", {
          limit: "5",
          skip: "3",
          sort: JSON.stringify({name: 1})
        });
        expect(meta.total).toBe(20);
        expect(data.length).toBe(5);

        for (const [index, object] of data.entries()) {
          expect(object._id).toBeDefined();
          expect(object.name).toBe(`name ${index + 1 + 3}.txt`);
          expect(object.url).toBe(`http://insteadof/storage/${object._id}/view`);
        }
      });

      it("descend by name", async () => {
        const {
          body: {meta, data}
        } = await req.get("/storage", {
          limit: "5",
          skip: "3",
          sort: JSON.stringify({name: -1})
        });
        expect(meta.total).toBe(20);
        expect(data.length).toBe(5);

        for (const [index, object] of data.entries()) {
          expect(object._id).toBeDefined();
          expect(object.name).toBe(`name ${data.length + 3 - index}.txt`);
          expect(object.url).toBe(`http://insteadof/storage/${object._id}/view`);
        }
      });
    });
  });

  describe("find", () => {
    it("should return storage object when metadata is true", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const {body: response} = await req.get(`/storage/${row._id}`, {metadata: "true"});
      expect(response._id).toEqual(row._id);
      expect(response.url).toEqual(row.url);
      expect(response.name).toEqual(row.name);
    });

    it("should show deprecation error when metadata is false", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const {body: response} = await req.request({
        method: "GET",
        path: `/storage/${row._id}`,
        followRedirect: false,
        query: {metadata: "false"}
      });
      expect(response).toEqual({
        error: "Deprecated",
        message: "Fetching objects via this is deprecated.",
        url: `http://insteadof/storage/${row._id}/view`
      });
    });

    it("should redirect permanently when metadata is false", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const {body: response, headers} = await req.get(`/storage/${row._id}`, {metadata: "false"});
      expect(headers["content-type"]).toEqual("text/plain; charset=utf-8");
      expect(response).toBe("content 20");
    });
  });

  describe("show", () => {
    it("should send 304 status if object etag matches if-none-match", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const {statusCode, statusText} = await req.get(
        `/storage/${row._id}/view`,
        {},
        {"If-None-Match": etag("content 20")}
      );
      expect(statusCode).toBe(304);
      expect(statusText).toBe("Not Modified");
    });

    it("should show the object if if-none-match does not match", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const {headers, body} = await req.get(
        `/storage/${row._id}/view`,
        {},
        {"If-None-Match": etag("content 21")}
      );
      expect(headers["content-type"]).toEqual("text/plain; charset=utf-8");
      expect(headers["etag"]).toBe(etag("content 20"));
      expect(body).toBe("content 20");
    });

    it("should send the ETag", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const {headers} = await req.get(`/storage/${row._id}/view`, {metadata: "false"});
      expect(headers["content-type"]).toBe("text/plain; charset=utf-8");
      expect(headers["etag"]).toBe(etag("content 20"));
    });
  });

  describe("put", () => {
    it("should show updated storage object", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      row.content.data = new BSON.Binary(Buffer.from("new data"));
      await req.put(`/storage/${row._id}`, BSON.serialize(row), {
        "Content-Type": "application/bson"
      });

      const {body} = await req.get(`/storage/${row._id}`);

      expect(body).toBe("new data");
    });

    it("should throw an error if updated data is empty", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const {statusCode, statusText, body: __} = await req.put(
        `/storage/${row._id}`,
        BSON.serialize(row),
        {
          "Content-Type": "application/bson"
        }
      );
      expect(statusCode).toEqual(400);
      expect(statusText).toEqual("Bad Request");

      const {body} = await req.get(`/storage/${row._id}`, {withMeta: "false"});
      expect(body).toBe("content 20");
    });

    it("should throw an error if the updated data is larger than the object size limit", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const size = 0.2 * 1024 * 1024;
      row.content.data = new BSON.Binary(Buffer.alloc(size, "f"));
      const {statusCode, statusText} = await req.put(`/storage/${row._id}`, BSON.serialize(row), {
        "Content-Type": "application/bson"
      });
      expect(statusCode).toBe(413);
      expect(statusText).toBe("Payload Too Large");
    });
  });

  describe("post", () => {
    it("should insert single storage object", async () => {
      const data: StorageObject<BSON.Binary> = {
        name: "remoteconfig.json",
        content: {
          data: new BSON.Binary(Buffer.from("{}")),
          type: "application/json"
        }
      };
      const {body, statusCode, statusText} = await req.post(
        "/storage",
        BSON.serialize({content: [data]}),
        {
          "Content-Type": "application/bson"
        }
      );

      expect(body).toEqual([
        {
          _id: "__skip__",
          name: "remoteconfig.json",
          url: "__skip_if_valid_url__",
          content: {
            type: "application/json",
            size: 2
          }
        }
      ]);
      expect(statusCode).toBe(201);
      expect(statusText).toBe("Created");
    });

    it("should insert storage objects", async () => {
      const objects = [
        {
          name: "remote config.json",
          content: {
            data: new BSON.Binary(Buffer.from("{}")),
            type: "application/json"
          }
        },
        {
          name: "remote config backup.json",
          content: {
            data: new BSON.Binary(Buffer.from("[]")),
            type: "application/json"
          }
        }
      ];
      const {statusCode, statusText, body} = await req.post(
        "/storage",
        BSON.serialize({content: objects}),
        {
          "Content-Type": "application/bson"
        }
      );

      expect(body).toEqual([
        {
          _id: "__skip__",
          name: "remote config.json",
          url: "__skip_if_valid_url__",
          content: {
            size: 2,
            type: "application/json"
          }
        },
        {
          _id: "__skip__",
          name: "remote config backup.json",
          url: "__skip_if_valid_url__",
          content: {
            size: 2,
            type: "application/json"
          }
        }
      ]);

      expect(statusCode).toBe(201);
      expect(statusText).toBe("Created");
    });

    it("should throw an error if the inserted object's data is empty", async () => {
      const objects = [
        {
          name: "invalid.json",
          content: {
            data: null,
            type: "application/json"
          }
        },
        {
          name: "valid.json",
          content: {
            data: new BSON.Binary(Buffer.from("[]")),
            type: "application/json"
          }
        }
      ];
      const {statusCode, statusText} = await req.post(
        "/storage",
        BSON.serialize({content: objects}),
        {
          "Content-Type": "application/bson"
        }
      );

      expect(statusCode).toBe(400);
      expect(statusText).toBe("Bad Request");

      const {body: upstreamObjects} = await req.get("/storage");
      expect(upstreamObjects.data.length).toBe(20);
    });

    it("should throw an error if the inserted data is larger than the object size limit", async () => {
      const size = 0.2 * 1024 * 1024;
      const objects = [
        {
          name: "password.txt",
          content: {
            data: new BSON.Binary(Buffer.alloc(size, "f")),
            type: "text/plain"
          }
        }
      ];
      const {statusCode, statusText} = await req.post(
        "/storage",
        BSON.serialize({content: objects}),
        {
          "Content-Type": "application/bson"
        }
      );
      expect(statusCode).toBe(413);
      expect(statusText).toBe("Payload Too Large");
    });
  });

  describe("delete", () => {
    it("should delete storage object", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage");

      const response = await req.delete(`/storage/${row._id}`);
      expect(response.statusCode).toBe(200);
      expect(response.statusText).toBe("OK");

      const {body: storageObjects} = await req.get("/storage");
      expect(storageObjects.meta.total).toBe(19);
      expect(storageObjects.data.length).toEqual(19);

      const deletedStorageObjectResponse = await req.get(`/storage/${row._id}`);
      expect(deletedStorageObjectResponse.statusCode).toBe(404);
      expect(deletedStorageObjectResponse.statusText).toBe("Not Found");
    });
  });

  describe("application/json", () => {
    it("should insert single storage object", async () => {
      const object: StorageObject<string> = {
        name: "remoteconfig.json",
        content: {
          data: Buffer.from("{}").toString("base64"),
          type: "application/json"
        }
      };
      const {body, statusCode, statusText} = await req.post("/storage", [object]);

      expect(body).toEqual([
        {
          _id: "__skip__",
          name: "remoteconfig.json",
          url: "__skip_if_valid_url__",
          content: {
            type: "application/json",
            size: 2
          }
        }
      ]);
      expect(statusCode).toBe(201);
      expect(statusText).toBe("Created");
    });

    it("should update the storage object", async () => {
      const {
        body: {
          data: [row]
        },
        headers: {["etag"]: prevETag}
      } = await req.get("/storage", {});
      row.content.data = Buffer.from("new data").toString("base64");
      await req.put(`/storage/${row._id}`, row);
      const {
        body,
        headers: {["etag"]: ETag}
      } = await req.get(`/storage/${row._id}`);
      expect(body).toBe("new data");
      expect(prevETag).not.toBe(ETag);
    });

    it("should throw an error if the updated data is larger than the object size limit", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const size = 0.2 * 1024 * 1024;
      row.content.data = Buffer.alloc(size, "f").toString("base64");
      const {statusCode, statusText, body} = await req.put(`/storage/${row._id}`, [row]);
      expect(statusCode).toBe(413);
      expect(statusText).toBe("Payload Too Large");
    });

    it("should throw an error if the inserted data is larger than the object size limit", async () => {
      const size = 0.2 * 1024 * 1024;
      const object: StorageObject<string> = {
        name: "password.txt",
        content: {
          data: Buffer.alloc(size, "f").toString("base64"),
          type: "text/plain"
        }
      };
      const {statusCode, statusText} = await req.post("/storage", [object], {
        "Content-Type": "application/bson"
      });
      expect(statusCode).toBe(413);
      expect(statusText).toBe("Payload Too Large");
    });
  });
});
