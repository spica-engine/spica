import {INestApplication, NestApplicationOptions} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {getMultipartFormDataMeta, StorageModule} from "@spica-server/storage";
import {Binary, serialize} from "bson";
import etag from "etag";
import {StorageObject} from "@spica-server/interface/storage";

describe("Storage Acceptance", () => {
  let app: INestApplication;
  let req: Request;

  async function addTextObjects() {
    const first = {
      name: `first.txt`,
      content: {
        data: new Binary(Buffer.from("first")),
        type: `text/plain`
      }
    };

    const second = {
      name: `second.txt`,
      content: {
        data: new Binary(Buffer.from("second")),
        type: `text/plain`
      }
    };

    const third = {
      name: `third.txt`,
      content: {
        data: new Binary(Buffer.from("third")),
        type: `text/plain`
      }
    };

    return await req.post("/storage", serialize({content: [first, second, third]}), {
      "Content-Type": "application/bson"
    });
  }

  const urlRegex = /http:\/\/insteadof\/storage\/.*?\/view/;

  async function initModule(options: NestApplicationOptions) {
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.standalone(),
        StorageModule.forRoot({
          defaultPath: process.env.TEST_TMPDIR,
          defaultPublicUrl: "http://insteadof",
          strategy: "default",
          objectSizeLimit: 0.1,
          expirationPeriod: 0
        })
      ]
    }).compile();
    app = module.createNestApplication(options);
    req = module.get(Request);
    await app.listen(req.socket);

    // wait for indexes
    await new Promise((resolve, _) => setTimeout(resolve, 1000));

    await addTextObjects();
  }

  beforeEach(async () => {
    await initModule({bodyParser: false});
  });

  describe("paginate", () => {
    it("should work with paginate false", async () => {
      const {body} = await req.get("/storage", {
        paginate: false,
        limit: "1",
        sort: JSON.stringify({_id: -1})
      });

      expect(ObjectId.isValid(body[0]._id)).toEqual(true);
      expect(body).toEqual([
        {
          _id: body[0]._id,
          name: "third.txt",
          url: `http://insteadof/storage/third.txt/view`,
          content: {
            type: `text/plain`,
            size: 5
          }
        }
      ]);
    });

    it("should work with paginate true", async () => {
      const {body} = await req.get("/storage", {
        paginate: true,
        limit: "1",
        sort: JSON.stringify({_id: -1})
      });

      expect(body.meta).toEqual({total: 3});
      expect(ObjectId.isValid(body.data[0]._id)).toEqual(true);
      expect(body.data).toEqual([
        {
          _id: body.data[0]._id,
          name: "third.txt",
          url: `http://insteadof/storage/third.txt/view`,
          content: {
            type: `text/plain`,
            size: 5
          }
        }
      ]);
    });

    it("should work with paginate true and zero result", async () => {
      const {body} = await req.get("/storage", {
        paginate: true,
        filter: JSON.stringify({name: "non_exist_name"})
      });

      expect(body.meta).toEqual({total: 0});
      expect(body.data).toEqual([]);
    });

    it("should work with paginate false and zero result", async () => {
      const {body} = await req.get("/storage", {
        paginate: false,
        filter: JSON.stringify({name: "non_exist_name"})
      });

      expect(body).toEqual([]);
    });
  });

  describe("filter", () => {
    it("should work with filter", async () => {
      const {body} = await req.get("/storage", {
        filter: JSON.stringify({name: "third.txt"})
      });

      expect(ObjectId.isValid(body[0]._id)).toEqual(true);
      expect(body).toEqual([
        {
          _id: body[0]._id,
          name: "third.txt",
          url: `http://insteadof/storage/third.txt/view`,
          content: {
            type: `text/plain`,
            size: 5
          }
        }
      ]);
    });
  });

  describe("index", () => {
    it("should work with limit", async () => {
      const {
        body: {meta, data}
      } = await req.get("/storage", {paginate: true, limit: "1", sort: JSON.stringify({_id: -1})});

      expect(meta.total).toBe(3);
      expect(ObjectId.isValid(data[0]._id)).toEqual(true);
      expect(data).toEqual([
        {
          _id: data[0]._id,
          name: "third.txt",
          url: `http://insteadof/storage/third.txt/view`,
          content: {
            type: `text/plain`,
            size: 5
          }
        }
      ]);
    });

    it("should work with skip", async () => {
      const {
        body: {meta, data}
      } = await req.get("/storage", {paginate: true, skip: "1", sort: JSON.stringify({_id: -1})});

      expect(meta.total).toBe(3);
      expect(ObjectId.isValid(data[0]._id)).toEqual(true);
      expect(ObjectId.isValid(data[1]._id)).toEqual(true);
      expect(data).toEqual([
        {
          _id: data[0]._id,
          name: "second.txt",
          url: `http://insteadof/storage/second.txt/view`,
          content: {
            type: `text/plain`,
            size: 6
          }
        },
        {
          _id: data[1]._id,
          name: "first.txt",
          url: `http://insteadof/storage/first.txt/view`,
          content: {
            type: `text/plain`,
            size: 5
          }
        }
      ]);
    });

    it("should work with skip and limit query", async () => {
      const {
        body: {meta, data}
      } = await req.get("/storage", {
        paginate: true,
        skip: "1",
        limit: "1",
        sort: JSON.stringify({_id: -1})
      });

      expect(meta.total).toBe(3);
      expect(ObjectId.isValid(data[0]._id)).toEqual(true);
      expect(data).toEqual([
        {
          _id: data[0]._id,
          name: "second.txt",
          url: `http://insteadof/storage/second.txt/view`,
          content: {
            type: `text/plain`,
            size: 6
          }
        }
      ]);
    });

    describe("sort", () => {
      it("ascend by name", async () => {
        const {
          body: {meta, data}
        } = await req.get("/storage", {
          paginate: true,
          sort: JSON.stringify({name: 1})
        });

        expect(meta.total).toBe(3);
        expect(ObjectId.isValid(data[0]._id)).toEqual(true);
        expect(ObjectId.isValid(data[1]._id)).toEqual(true);
        expect(ObjectId.isValid(data[2]._id)).toEqual(true);
        expect(data).toEqual([
          {
            _id: data[0]._id,
            name: "first.txt",
            url: `http://insteadof/storage/first.txt/view`,
            content: {
              type: `text/plain`,
              size: 5
            }
          },
          {
            _id: data[1]._id,
            name: "second.txt",
            url: `http://insteadof/storage/second.txt/view`,
            content: {
              type: `text/plain`,
              size: 6
            }
          },
          {
            _id: data[2]._id,
            name: "third.txt",
            url: `http://insteadof/storage/third.txt/view`,
            content: {
              type: `text/plain`,
              size: 5
            }
          }
        ]);
      });

      it("descend by name", async () => {
        const {
          body: {meta, data}
        } = await req.get("/storage", {
          paginate: true,
          sort: JSON.stringify({name: -1})
        });

        expect(meta.total).toBe(3);
        expect(ObjectId.isValid(data[0]._id)).toEqual(true);
        expect(ObjectId.isValid(data[1]._id)).toEqual(true);
        expect(ObjectId.isValid(data[2]._id)).toEqual(true);
        expect(data).toEqual([
          {
            _id: data[0]._id,
            name: "third.txt",
            url: `http://insteadof/storage/third.txt/view`,
            content: {
              type: `text/plain`,
              size: 5
            }
          },
          {
            _id: data[1]._id,
            name: "second.txt",
            url: `http://insteadof/storage/second.txt/view`,
            content: {
              type: `text/plain`,
              size: 6
            }
          },
          {
            _id: data[2]._id,
            name: "first.txt",
            url: `http://insteadof/storage/first.txt/view`,
            content: {
              type: `text/plain`,
              size: 5
            }
          }
        ]);
      });
    });
  });

  describe("find", () => {
    it("should return storage object", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {paginate: true});
      const {body: response} = await req.get(`/storage/${row._id}`);
      expect(response._id).toEqual(row._id);
      expect(response.url).toEqual(row.url);
      expect(response.name).toEqual(row.name);
    });
  });

  describe("show", () => {
    it("should send 304 status if object etag matches if-none-match", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {paginate: true, sort: JSON.stringify({_id: -1})});
      const {statusCode, statusText} = await req.get(
        `/storage/${row._id}/view`,
        {},

        {"If-None-Match": etag("third")}
      );
      expect(statusCode).toBe(304);
      expect(statusText).toBe("Not Modified");
    });

    it("should show the object if if-none-match does not match", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {paginate: true, sort: JSON.stringify({_id: -1})});
      const {headers, body} = await req.get(
        `/storage/${row._id}/view`,
        {},
        {"If-None-Match": etag("unexist content")}
      );
      expect(headers["content-type"]).toEqual("text/plain; charset=utf-8");
      expect(headers["etag"]).toBe(etag("third"));
      expect(body).toBe("third");
    });

    it("should send the ETag", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {paginate: true, sort: JSON.stringify({_id: -1})});
      const {headers} = await req.get(`/storage/${row._id}/view`);
      expect(headers["content-type"]).toBe("text/plain; charset=utf-8");
      expect(headers["etag"]).toBe(etag("third"));
    });
  });

  describe("put", () => {
    it("should show updated storage object", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {paginate: true, sort: JSON.stringify({_id: -1})});

      row.content.data = new Binary(Buffer.from("new data"));

      const id = row._id;
      delete row._id;
      delete row.url;

      await req.put(`/storage/${id}`, serialize(row), {
        "Content-Type": "application/bson"
      });

      const {body} = await req.get(`/storage/${id}/view`);

      expect(body).toBe("new data");
    });

    it("should throw an error if updated data is empty", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {paginate: true, sort: JSON.stringify({_id: -1})});
      const {
        statusCode,
        statusText,
        body: __
      } = await req.put(`/storage/${row._id}`, serialize(row), {
        "Content-Type": "application/bson"
      });
      expect(statusCode).toEqual(400);
      expect(statusText).toEqual("Bad Request");

      const {body} = await req.get(`/storage/${row._id}/view`);
      expect(body).toBe("third");
    });

    it("should throw an error if the updated data is larger than the object size limit", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {paginate: true});
      const size = 0.2 * 1024 * 1024;
      row.content.data = new Binary(Buffer.alloc(size, "f"));
      const {statusCode, statusText} = await req.put(`/storage/${row._id}`, serialize(row), {
        "Content-Type": "application/bson"
      });
      expect(statusCode).toBe(413);
      expect(statusText).toBe("Payload Too Large");
    });
  });

  describe("patch", () => {
    beforeEach(async () => {
      await initModule({});
    });

    it("should patch storage object name", async () => {
      const {
        body: [first]
      } = await req.get("/storage", {
        filter: JSON.stringify({name: "first.txt"})
      });

      let res = await req.patch(`/storage/${first._id}`, {name: "updated_first.txt"});
      const expectedObject = {
        _id: res.body._id,
        name: "updated_first.txt",
        url: `http://insteadof/storage/updated_first.txt/view`,
        content: {
          type: `text/plain`,
          size: 5
        }
      };
      expect(ObjectId.isValid(res.body._id)).toEqual(true);
      expect(res.body).toEqual(expectedObject);

      res = await req.get(`storage/${first._id}`);
      expect(ObjectId.isValid(res.body._id)).toEqual(true);
      expect(res.body).toEqual({
        _id: res.body._id,
        name: "updated_first.txt",
        url: `http://insteadof/storage/updated_first.txt/view`,
        content: {
          type: `text/plain`,
          size: 5
        }
      });
    });
  });

  describe("post", () => {
    afterEach(async () => {
      const res = await req.get("/storage");
      for (let obj of res.body) {
        await req.delete("/storage", obj._id);
      }
    });

    it("should insert single storage object", async () => {
      const data: StorageObject<Binary> = {
        name: "remoteconfig.json",
        content: {
          data: new Binary(Buffer.from("{}")),
          type: "application/json"
        }
      };
      const {body, statusCode, statusText} = await req.post(
        "/storage",
        serialize({content: [data]}),
        {
          "Content-Type": "application/bson"
        }
      );

      expect(ObjectId.isValid(body[0]._id)).toEqual(true);
      expect(urlRegex.test(body[0].url)).toEqual(true);
      expect(body).toEqual([
        {
          _id: body[0]._id,
          name: "remoteconfig.json",
          url: body[0].url,
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
            data: new Binary(Buffer.from("{}")),
            type: "application/json"
          }
        },
        {
          name: "remote config backup.json",
          content: {
            data: new Binary(Buffer.from("[]")),
            type: "application/json"
          }
        }
      ];
      const {statusCode, statusText, body} = await req.post(
        "/storage",
        serialize({content: objects}),
        {
          "Content-Type": "application/bson"
        }
      );

      expect(ObjectId.isValid(body[0]._id)).toEqual(true);
      expect(ObjectId.isValid(body[1]._id)).toEqual(true);

      expect(urlRegex.test(body[0].url)).toEqual(true);
      expect(urlRegex.test(body[1].url)).toEqual(true);

      expect(body).toEqual([
        {
          _id: body[0]._id,
          name: "remote config.json",
          url: body[0].url,
          content: {
            size: 2,
            type: "application/json"
          }
        },
        {
          _id: body[1]._id,
          name: "remote config backup.json",
          url: body[1].url,
          content: {
            size: 2,
            type: "application/json"
          }
        }
      ]);

      expect(statusCode).toBe(201);
      expect(statusText).toBe("Created");
    });

    it("should throw a duplicate name error", async () => {
      const objects = [
        {
          name: "remote config.json",
          content: {
            data: new Binary(Buffer.from("{}")),
            type: "application/json"
          }
        },
        {
          name: "remote config.json",
          content: {
            data: new Binary(Buffer.from("[]")),
            type: "application/json"
          }
        }
      ];

      const res = await req.post("/storage", serialize({content: objects}), {
        "Content-Type": "application/bson"
      });

      expect(res.statusCode).toEqual(400);
      expect(res.statusText).toEqual("Bad Request");
      expect(res.body.message).toEqual("An object with this name already exists.");
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
            data: new Binary(Buffer.from("[]")),
            type: "application/json"
          }
        }
      ];
      const {statusCode, statusText} = await req.post("/storage", serialize({content: objects}), {
        "Content-Type": "application/bson"
      });

      expect(statusCode).toBe(400);
      expect(statusText).toBe("Bad Request");

      const {body: upstreamObjects} = await req.get("/storage", {paginate: true});
      expect(upstreamObjects.data.length).toBe(3);
    });

    it("should throw an error if the inserted data is larger than the object size limit", async () => {
      const size = 0.2 * 1024 * 1024;
      const objects = [
        {
          name: "password.txt",
          content: {
            data: new Binary(Buffer.alloc(size, "f")),
            type: "text/plain"
          }
        }
      ];
      const {statusCode, statusText} = await req.post("/storage", serialize({content: objects}), {
        "Content-Type": "application/bson"
      });
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
      } = await req.get("/storage", {paginate: true});

      const response = await req.delete(`/storage/${row._id}`);
      expect(response.statusCode).toBe(204);
      expect(response.statusText).toBe("No Content");
      expect(response.body).toBe(undefined);

      const {body: storageObjects} = await req.get("/storage", {paginate: true});
      expect(storageObjects.meta.total).toBe(2);
      expect(storageObjects.data.length).toEqual(2);

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

      expect(ObjectId.isValid(body[0]._id)).toEqual(true);
      expect(urlRegex.test(body[0].url)).toEqual(true);

      expect(body).toEqual([
        {
          _id: body[0]._id,
          name: "remoteconfig.json",
          url: body[0].url,
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
      } = await req.get("/storage", {paginate: true, sort: JSON.stringify({_id: -1})});

      row.content.data = Buffer.from("new data").toString("base64");

      const id = row._id;
      delete row._id;

      delete row.url;

      await req.put(`/storage/${id}`, row);

      const {
        body,
        headers: {["etag"]: ETag}
      } = await req.get(`/storage/${id}/view`);

      expect(body).toBe("new data");
      expect(prevETag).not.toBe(ETag);
    });

    it("should throw an error if the updated data is larger than the object size limit", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {paginate: true});
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

  describe("multipart/form-data", () => {
    it("should insert storage objects", async () => {
      const {body, headers} = getMultipartFormDataMeta(
        [
          {name: "data.json", data: "{}", type: "application/json"},
          {name: "test.txt", data: "hello", type: "text/plain"}
        ],
        "post"
      );
      const {body: resBody, statusCode, statusText} = await req.post("/storage", body, headers);

      expect(ObjectId.isValid(resBody[0]._id)).toEqual(true);
      expect(ObjectId.isValid(resBody[1]._id)).toEqual(true);

      expect(urlRegex.test(resBody[0].url)).toEqual(true);
      expect(urlRegex.test(resBody[1].url)).toEqual(true);

      expect(resBody).toEqual([
        {
          _id: resBody[0]._id,
          name: "data.json",
          url: resBody[0].url,
          content: {
            type: "application/json",
            size: 2
          }
        },
        {
          _id: resBody[1]._id,
          name: "test.txt",
          url: resBody[1].url,
          content: {
            type: "text/plain",
            size: 5
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
      } = await req.get("/storage", {paginate: true, sort: JSON.stringify({_id: -1})});

      const {body, headers} = getMultipartFormDataMeta(
        [
          {
            data: "new data",
            name: row.name,
            type: row.content.type
          }
        ],
        "put"
      );

      const id = row._id;

      await req.put(`/storage/${id}`, body, headers);

      const {
        body: resBody,
        headers: {["etag"]: ETag}
      } = await req.get(`/storage/${id}/view`);

      expect(resBody).toBe("new data");
      expect(prevETag).not.toBe(ETag);
    });
  });
});
