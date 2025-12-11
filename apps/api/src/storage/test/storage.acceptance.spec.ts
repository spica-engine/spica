import {INestApplication, NestApplicationOptions, ForbiddenException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {getMultipartFormDataMeta, StorageModule} from "@spica-server/storage";
import {Binary, serialize} from "bson";
import etag from "etag";
import {StorageObject} from "@spica-server/interface/storage";
import {GuardService} from "@spica-server/passport/guard/services";

describe("Storage Acceptance", () => {
  let app: INestApplication;
  let req: Request;
  let guardService: GuardService;

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
          resumableUploadExpiresIn: 1000 * 60 // 1 minute
        })
      ]
    }).compile();
    app = module.createNestApplication(options);
    req = module.get(Request);
    guardService = module.get(GuardService);
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
          created_at: body[0].created_at,
          updated_at: body[0].updated_at,
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
          created_at: body.data[0].created_at,
          updated_at: body.data[0].updated_at,
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
          created_at: body[0].created_at,
          updated_at: body[0].updated_at,
          content: {
            type: `text/plain`,
            size: 5
          }
        }
      ]);
    });

    it("should work with _id filter", async () => {
      const {body} = await req.get("/storage", {
        filter: JSON.stringify({name: "third.txt"})
      });

      const response = await req.get("/storage", {
        filter: JSON.stringify({_id: body[0]._id})
      });

      expect(ObjectId.isValid(response.body[0]._id)).toEqual(true);
      expect(body).toEqual([
        {
          _id: response.body[0]._id,
          name: "third.txt",
          url: `http://insteadof/storage/third.txt/view`,
          created_at: body[0].created_at,
          updated_at: body[0].updated_at,
          content: {
            type: `text/plain`,
            size: 5
          }
        }
      ]);
    });

    it("should work with date filter", async () => {
      const newData = {
        name: "newData.txt",
        content: {
          data: new Binary(Buffer.from("newData")),
          type: "text/plain",
          size: 7
        }
      };

      const postRes = await req.post("/storage", serialize({content: [newData]}), {
        "Content-Type": "application/bson"
      });

      const body = postRes.body;

      const ltRes = await req.get("/storage", {
        filter: JSON.stringify({created_at: {$lt: body[0].created_at}})
      });

      const gteRes = await req.get("/storage", {
        filter: JSON.stringify({created_at: {$gte: body[0].created_at}})
      });

      expect(gteRes.body).toEqual([
        {
          _id: gteRes.body[0]._id,
          name: "newData.txt",
          url: `http://insteadof/storage/newData.txt/view`,
          created_at: gteRes.body[0].created_at,
          updated_at: gteRes.body[0].updated_at,
          content: {
            type: `text/plain`,
            size: 7
          }
        }
      ]);

      expect(ltRes.body).toEqual([
        {
          _id: ltRes.body[0]._id,
          name: "first.txt",
          url: `http://insteadof/storage/first.txt/view`,
          created_at: ltRes.body[0].created_at,
          updated_at: ltRes.body[0].updated_at,
          content: {
            type: `text/plain`,
            size: 5
          }
        },
        {
          _id: ltRes.body[1]._id,
          name: "second.txt",
          url: `http://insteadof/storage/second.txt/view`,
          created_at: ltRes.body[1].created_at,
          updated_at: ltRes.body[1].updated_at,
          content: {
            type: `text/plain`,
            size: 6
          }
        },
        {
          _id: ltRes.body[2]._id,
          name: "third.txt",
          url: `http://insteadof/storage/third.txt/view`,
          created_at: ltRes.body[2].created_at,
          updated_at: ltRes.body[2].updated_at,
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
          created_at: data[0].created_at,
          updated_at: data[0].updated_at,
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
          created_at: data[0].created_at,
          updated_at: data[0].updated_at,
          content: {
            type: `text/plain`,
            size: 6
          }
        },
        {
          _id: data[1]._id,
          name: "first.txt",
          url: `http://insteadof/storage/first.txt/view`,
          created_at: data[1].created_at,
          updated_at: data[1].updated_at,
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
          created_at: data[0].created_at,
          updated_at: data[0].updated_at,
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
            created_at: data[0].created_at,
            updated_at: data[0].updated_at,
            content: {
              type: `text/plain`,
              size: 5
            }
          },
          {
            _id: data[1]._id,
            name: "second.txt",
            url: `http://insteadof/storage/second.txt/view`,
            created_at: data[1].created_at,
            updated_at: data[1].updated_at,
            content: {
              type: `text/plain`,
              size: 6
            }
          },
          {
            _id: data[2]._id,
            name: "third.txt",
            url: `http://insteadof/storage/third.txt/view`,
            created_at: data[2].created_at,
            updated_at: data[2].updated_at,
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
            created_at: data[0].created_at,
            updated_at: data[0].updated_at,
            content: {
              type: `text/plain`,
              size: 5
            }
          },
          {
            _id: data[1]._id,
            name: "second.txt",
            url: `http://insteadof/storage/second.txt/view`,
            created_at: data[1].created_at,
            updated_at: data[1].updated_at,
            content: {
              type: `text/plain`,
              size: 6
            }
          },
          {
            _id: data[2]._id,
            name: "first.txt",
            url: `http://insteadof/storage/first.txt/view`,
            created_at: data[2].created_at,
            updated_at: data[2].updated_at,
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
      delete row.created_at;
      delete row.updated_at;

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
        created_at: res.body.created_at,
        updated_at: res.body.updated_at,
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
        created_at: res.body.created_at,
        updated_at: res.body.updated_at,
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
          created_at: body[0].created_at,
          updated_at: body[0].updated_at,
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
          created_at: body[0].created_at,
          updated_at: body[0].updated_at,
          content: {
            size: 2,
            type: "application/json"
          }
        },
        {
          _id: body[1]._id,
          name: "remote config backup.json",
          url: body[1].url,
          created_at: body[1].created_at,
          updated_at: body[1].updated_at,
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

    it("should delete multiple storage objects successfully", async () => {
      const {
        body: {data: objects}
      } = await req.get("/storage", {paginate: true});

      expect(objects.length).toBeGreaterThanOrEqual(3);

      const idsToDelete = [objects[0]._id.toString(), objects[1]._id.toString()];
      const response = await req.delete("/storage", idsToDelete);

      expect(response.statusCode).toBe(204);
      expect(response.statusText).toBe("No Content");
      expect(response.body).toBe(undefined);

      const {body: storageObjects} = await req.get("/storage", {paginate: true});
      expect(storageObjects.meta.total).toBe(objects.length - 2);

      const remainingIds = storageObjects.data.map((obj: any) => obj._id.toString());
      expect(remainingIds.some((id: string) => idsToDelete.includes(id))).toBe(false);
    });

    it("should return 400 for invalid IDs in deleteMany request", async () => {
      const invalidIds = ["invalid-id-1", "invalid-id-2"];

      const response = await req.delete("/storage", invalidIds);

      expect(response.statusCode).toBe(500);
      expect(response.statusText).toBe("Internal Server Error");
    });

    it("should fail when user lacks permission to delete one of the objects", async () => {
      const {
        body: {data: objects}
      } = await req.get("/storage", {paginate: true});

      expect(objects.length).toBeGreaterThanOrEqual(2);

      const unauthorizedId = new ObjectId().toString();
      const idsToDelete = [objects[0]._id.toString(), unauthorizedId];

      const originalCheckAction = guardService.checkAction;
      jest.spyOn(guardService, "checkAction").mockImplementation((args: any) => {
        if (args.request?.params?.id === unauthorizedId) {
          throw new ForbiddenException(
            `You don't have permission to delete storage object: ${unauthorizedId}`
          );
        }
        return originalCheckAction.call(guardService, args);
      });

      const response = await req.delete("/storage", idsToDelete);
      console.log(response);
      jest.restoreAllMocks();

      expect(response.statusCode).toBe(403);
      expect(response.statusText).toBe("Forbidden");
      expect(response.body.message).toContain(
        `You don't have permission to delete storage object: ${unauthorizedId}`
      );

      const {body: afterObjects} = await req.get("/storage", {paginate: true});
      expect(afterObjects.meta.total).toBe(objects.length);
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
          created_at: body[0].created_at,
          updated_at: body[0].updated_at,
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
      delete row.created_at;
      delete row.updated_at;

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
          created_at: resBody[0].created_at,
          updated_at: resBody[0].updated_at,
          content: {
            type: "application/json",
            size: 2
          }
        },
        {
          _id: resBody[1]._id,
          name: "test.txt",
          url: resBody[1].url,
          created_at: resBody[1].created_at,
          updated_at: resBody[1].updated_at,
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

  describe("resumable upload", () => {
    it("should return upload url", async () => {
      const res = await req.post("/storage/resumable", undefined, {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": "100"
      });

      expect(res.statusCode).toBe(201);
      expect(res.headers["location"]).toBeDefined();
    });

    it("should upload and rename", async () => {
      const content = Buffer.from("new data");
      const object = {
        name: "file.txt",
        content: {
          data: new Binary(content),
          type: "text/plain"
        }
      };

      const actualSize = content.byteLength;

      const postRes = await req.post("/storage/resumable", undefined, {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(actualSize),
        "Upload-Metadata": `filename ${Buffer.from(object.name).toString("base64")}`
      });

      expect(postRes.statusCode).toBe(201);
      expect(postRes.headers["location"]).toBeDefined();

      const fileId = postRes.headers["location"].split("/").at(-1);
      const url = `/storage/resumable/${fileId}`;

      const res = await req.patch(url, content, {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream"
      });

      expect(res.statusCode).toBe(204);
      expect(res.headers["upload-offset"]).toBe(String(actualSize));

      // Wait until the object is added to the database
      await new Promise(resolve => setTimeout(resolve, 1000));

      const {body} = await req.get("/storage");
      const uploadedObject = body.at(-1);
      expect(uploadedObject.name).toBe(object.name);

      const {body: obj} = await req.get(`/storage/${uploadedObject._id}/view`);
      expect(obj).toBe("new data");
    });

    it("should resume upload if it was interrupted", async () => {
      const object = {
        name: "file.txt",
        content: {
          data: new Binary(Buffer.alloc(10, "f")),
          type: "text/plain"
        }
      };

      const serializedData = serialize({content: object});
      const actualSize = Buffer.byteLength(serializedData);

      const postRes = await req.post("/storage/resumable", undefined, {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(actualSize),
        "Upload-Metadata": `filename ${Buffer.from(object.name).toString("base64")}`
      });

      const fileId = postRes.headers["location"].split("/").at(-1);
      const url = `/storage/resumable/${fileId}`;

      // Simulate an interruption
      const res = await req.patch(url, serializedData.slice(0, 5), {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream"
      });

      expect(res.statusCode).toBe(204);
      expect(res.headers["upload-offset"]).toBe("5");

      // Resume the upload
      const resumeRes = await req.patch(url, serializedData.slice(5), {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "5",
        "Content-Type": "application/offset+octet-stream"
      });

      expect(resumeRes.statusCode).toBe(204);
      expect(resumeRes.headers["upload-offset"]).toBe(String(actualSize));

      // Wait until the object is added to the database
      await new Promise(resolve => setTimeout(resolve, 1000));

      const {body} = await req.get("/storage");
      const uploadedObject = body.at(-1);
      expect(uploadedObject.name).toBe(object.name);
    });

    it("should remove expired upload", async () => {
      const object = {
        name: "file.txt",
        content: {
          data: new Binary(Buffer.alloc(10, "f")),
          type: "text/plain"
        }
      };

      const serializedData = serialize({content: object});
      const actualSize = Buffer.byteLength(serializedData);

      const postRes = await req.post("/storage/resumable", undefined, {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(actualSize),
        "Upload-Metadata": `filename ${Buffer.from(object.name).toString("base64")}`
      });

      const fileId = postRes.headers["location"].split("/").at(-1);
      const url = `/storage/resumable/${fileId}`;

      // Simulate an interruption
      const res = await req.patch(url, serializedData.slice(0, 5), {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream"
      });

      expect(res.statusCode).toBe(204);
      expect(res.headers["upload-offset"]).toBe("5");

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000 * 60 + 1000); // Advance time to expire the upload

      const expiredRes = await req.get(url, {}, {"Tus-Resumable": "1.0.0"});

      jest.useRealTimers();

      expect(expiredRes.statusCode).toBe(404);
    });
  });

  describe("get by name operations", () => {
    it("should return storage object by name", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {paginate: true});
      const {body: response} = await req.get(`/storage/${row.name}`);
      expect(response._id).toEqual(row._id);
      expect(response.url).toEqual(row.url);
      expect(response.name).toEqual(row.name);
    });

    it("should show the object by name", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {paginate: true, sort: JSON.stringify({_id: -1})});
      const {headers, body} = await req.get(`/storage/${row.name}/view`);
      expect(headers["content-type"]).toEqual("text/plain; charset=utf-8");
      expect(headers["etag"]).toBe(etag("third"));
      expect(body).toBe("third");
    });
  });

  describe("rename folder", () => {
    beforeEach(async () => {
      await initModule({});

      const folder1 = {
        name: "folder/",
        content: {
          data: new Binary(Buffer.from("")),
          type: "application/octet-stream",
          size: 0
        }
      };
      const folder2 = {
        name: "folder/subfolder/",
        content: {
          data: new Binary(Buffer.from("")),
          type: "application/octet-stream",
          size: 0
        }
      };

      await req.post("/storage", serialize({content: [folder1, folder2]}), {
        "Content-Type": "application/bson"
      });

      const object1 = {
        name: "folder/subfolder/document.pdf",
        content: {
          data: new Binary(Buffer.from("pdf data in nested folder")),
          type: "application/pdf"
        }
      };

      await req.post("/storage", serialize({content: [object1]}), {
        "Content-Type": "application/bson"
      });
    });

    it("should rename the folder and its children based on new name", async () => {
      const {body: folderResponse} = await req.get("/storage", {
        filter: JSON.stringify({name: "folder/subfolder/"})
      });
      const subfolderId = folderResponse[0]._id;

      await req.patch(`/storage/${subfolderId}`, {
        name: "folder/subfolder_renamed/"
      });

      const {body: allItems} = await req.get("/storage");

      expect(allItems.length).toBe(6);
      expect(allItems.some(item => item.name == "folder/")).toBe(true);
      expect(allItems.some(item => item.name == "folder/subfolder_renamed/")).toBe(true);
      expect(allItems.some(item => item.name == "folder/subfolder_renamed/document.pdf")).toBe(
        true
      );
    });
  });

  describe("objects with slashes in names", () => {
    beforeEach(async () => {
      const folder1 = {
        name: "school/",
        content: {
          data: new Binary(Buffer.from("")),
          type: "application/octet-stream",
          size: 0
        }
      };
      const folder2 = {
        name: "folder/",
        content: {
          data: new Binary(Buffer.from("")),
          type: "application/octet-stream",
          size: 0
        }
      };
      const folder3 = {
        name: "folder/subfolder/",
        content: {
          data: new Binary(Buffer.from("")),
          type: "application/octet-stream",
          size: 0
        }
      };

      await req.post("/storage", serialize({content: [folder1, folder2, folder3]}), {
        "Content-Type": "application/bson"
      });

      const object1 = {
        name: "school/holiday.png",
        content: {
          data: new Binary(Buffer.from("image data in folder")),
          type: "image/png"
        }
      };
      const object2 = {
        name: "folder/subfolder/document.pdf",
        content: {
          data: new Binary(Buffer.from("pdf data in nested folder")),
          type: "application/pdf"
        }
      };

      await req.post("/storage", serialize({content: [object1, object2]}), {
        "Content-Type": "application/bson"
      });
    });

    it("should return storage object by name with slash", async () => {
      const {body: response} = await req.get("/storage/school/holiday.png");
      expect(response.name).toEqual("school/holiday.png");
      expect(response.content.type).toEqual("image/png");
    });

    it("should show the object by name with slash via view endpoint", async () => {
      const {headers, body} = await req.get("/storage/school/holiday.png/view");
      expect(headers["content-type"]).toContain("image/png");
      expect(body).toBe("image data in folder");
    });

    it("should return storage object by name with nested slashes", async () => {
      const {body: response} = await req.get("/storage/folder/subfolder/document.pdf");
      expect(response.name).toEqual("folder/subfolder/document.pdf");
      expect(response.content.type).toEqual("application/pdf");
    });

    it("should show the object by name with nested slashes via view endpoint", async () => {
      const {headers, body} = await req.get("/storage/folder/subfolder/document.pdf/view");
      expect(headers["content-type"]).toContain("application/pdf");
      expect(body).toBe("pdf data in nested folder");
    });
  });
});
