import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {StorageService} from "@spica-server/storage";
import {StorageObject} from "@spica-server/storage/src/body";
import {Default} from "@spica-server/storage/src/strategy/default";
import {Strategy} from "@spica-server/storage/src/strategy/strategy";
import {STORAGE_OPTIONS} from "@spica-server/storage/src/options";

describe("Storage Service", () => {
  let module: TestingModule;

  let storageService: StorageService;
  let storageObject: StorageObject<Buffer>;
  let strategyInstance: Strategy;
  let storageObjectId: ObjectId = new ObjectId("56cb91bdc3464f14678934ca");

  const resourceFilter = {$match: {}};

  beforeEach(async () => {
    storageObject = {
      _id: storageObjectId,
      name: "name",
      url: "url",
      content: {
        data: Buffer.from("abc"),
        type: "type",
        size: 10
      }
    };
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [
        StorageService,
        {
          provide: Strategy,
          useValue: new Default(process.env.TEST_TMPDIR, "http://insteadof")
        },
        {
          provide: STORAGE_OPTIONS,
          useValue: {totalSizeLimit: 10}
        }
      ]
    }).compile();
    storageService = module.get(StorageService);
    strategyInstance = module.get(Strategy);
  });

  afterEach(() => {
    storageService.deleteMany({});
    module.close();
  });

  it("should add storage objects", async () => {
    await expect(
      storageService.insert(
        Array.from(new Array(3), (val, index) => ({
          name: "name" + index,
          content: {
            data: Buffer.from("123"),
            type: index.toString()
          }
        }))
      )
    ).resolves.not.toThrow();

    return await expect(
      storageService.getAll(resourceFilter, undefined, true, 30, 0, {_id: -1}).then(result => {
        Array.from(result.data).forEach((val, index) => {
          expect(val.name).toBe("name" + (result.data.length - 1 - index));
          expect(val.content["data"]).toBe(undefined);
          expect(val.content.type).toBe((result.data.length - 1 - index).toString());
        });
        return result;
      })
    );
  });

  it("should not insert storage object with an already existing name", async () => {
    await storageService
      .insert([
        {
          name: "my_obj",
          content: {
            data: Buffer.from("123"),
            type: "0"
          }
        },
        {
          name: "my_obj",
          content: {
            data: Buffer.from("1234"),
            type: "1"
          }
        }
      ])
      .catch(error => {
        expect(error.response.statusCode).toBe(400);
        expect(error.response.message).toBe("An object with this name already exists.");
      });
  });

  it("should delete failed object from database", async () => {
    const storageObjects = [
      {
        _id: "successId",
        name: "name1",
        content: {
          data: Buffer.from("abc1"),
          type: "type1",
          size: 10
        }
      },
      {
        _id: "failId",
        name: "name2",
        content: {
          data: Buffer.from("abc2"),
          type: "type2",
          size: 20
        }
      },
      {
        _id: "thirdId",
        name: "name3",
        content: {
          data: Buffer.from("abc3"),
          type: "type3",
          size: 30
        }
      }
    ];
    jest.spyOn(strategyInstance, "write").mockImplementation((id: string, data: Buffer) => {
      if (id == "failId") {
        return Promise.reject("Upload failed for Item");
      }
      return Promise.resolve();
    });

    await expect(storageService.insert(storageObjects)).rejects.toThrow(
      "Error: Failed to write object name2 to storage. Reason: Upload failed for Item"
    );

    const insertedBbjects = await storageService.find();
    expect(insertedBbjects).toEqual([
      {
        _id: "successId",
        name: "name1",
        content: {
          type: "type1",
          size: 10
        }
      } as any
    ]);
  });

  it("should update storage object", async () => {
    await expect(storageService.insert([storageObject])).resolves.not.toThrow();

    const updatedData = {
      _id: storageObjectId,
      name: "new name",
      url: "new_url",
      content: {
        data: Buffer.from("cba"),
        type: "newtype",
        size: 10
      }
    };
    await expect(storageService.update(storageObjectId, updatedData)).resolves.not.toThrow();

    return await expect(
      storageService.get(storageObjectId).then(result => {
        expect(result).toEqual({
          _id: storageObjectId,
          name: "new name",
          url: "new_url",
          content: {
            data: Buffer.from("cba"),
            type: "newtype",
            size: 10
          }
        });
        return result;
      })
    ).resolves.not.toThrow();
  });

  it("should delete single storage object", async () => {
    await expect(storageService.insert([storageObject])).resolves.not.toThrow();
    await expect(storageService.delete(storageObjectId)).resolves.not.toThrow();
    return await expect(storageService.get(storageObjectId)).resolves.toBeNull();
  });

  describe("filter", () => {
    beforeEach(async () => {
      const storageObjects = [
        {
          name: "object1",
          content: {data: Buffer.from(""), type: "type1"}
        },
        {
          name: "object2",
          content: {data: Buffer.from(""), type: "type2"}
        }
      ];
      await storageService.insertMany(storageObjects);
    });

    it("should filter by name", async () => {
      const res = await storageService.getAll(resourceFilter, {name: "object1"}, false, 0, 0, {});
      expect(res.map(r => r.name)).toEqual(["object1"]);
    });

    it("should filter by content type", async () => {
      const res = await storageService.getAll(
        resourceFilter,
        {"content.type": "type1"},
        false,
        0,
        0,
        {}
      );
      expect(res.map(r => r.content.type)).toEqual(["type1"]);
    });
  });

  it("should filter, limit skip and sort and not paginate ", async () => {
    const storageObjects = [
      {
        name: "object1",
        content: {data: Buffer.from(""), type: "type1"}
      },
      {
        name: "object2",
        content: {data: Buffer.from(""), type: "type2"}
      },
      {
        name: "object3",
        content: {data: Buffer.from(""), type: "type3"}
      },
      {
        name: "won't_pass_filter",
        content: {data: Buffer.from(""), type: "type4"}
      }
    ];
    await storageService.insertMany(storageObjects);
    const res = await storageService.getAll(
      resourceFilter,
      {name: {$regex: "^object"}},
      false,
      2,
      1,
      {
        name: -1
      }
    );
    expect(res.map(r => r.name)).toEqual(["object2", "object1"]);
  });

  describe("sorts", () => {
    let storageObjects: StorageObject<Buffer>[];
    beforeEach(async () => {
      storageObjects = Array.from(new Array(3), (val, index) => ({
        name: "name" + (2 - index),
        content: {
          data: Buffer.from(""),
          type: ""
        }
      }));
      await storageService.insertMany(storageObjects);
    });

    it("should sort storage objects descend by name", async () => {
      return await expect(
        storageService.getAll(resourceFilter, undefined, true, 3, 0, {name: -1}).then(result => {
          expect(result.data[0].name).toBe("name2");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name0");
          return result;
        })
      ).resolves.not.toThrow();
    });

    it("should sort storage objects ascend by name", async () => {
      return await expect(
        storageService.getAll(resourceFilter, undefined, true, 3, 0, {name: 1}).then(result => {
          expect(result.data[0].name).toBe("name0");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name2");
          return result;
        })
      ).resolves.not.toThrow();
    });

    it("should sort storage objects descend by date", async () => {
      return await expect(
        storageService.getAll(resourceFilter, undefined, true, 3, 0, {_id: -1}).then(result => {
          expect(result.data[0].name).toBe("name0");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name2");
          return result;
        })
      ).resolves.not.toThrow();
    });

    it("should sort storage objects ascend by date", async () => {
      return await expect(
        storageService.getAll(resourceFilter, undefined, true, 3, 0, {_id: 1}).then(result => {
          expect(result.data[0].name).toBe("name2");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name0");
          return result;
        })
      ).resolves.not.toThrow();
    });
  });

  describe("storage size limit", () => {
    const MB = Math.pow(10, 6); // 1mb = 10^6 byte
    let storageObjects = [];

    it("should skip validation if total size limit was not provided", async () => {
      module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.standalone()],
        providers: [
          StorageService,
          {
            provide: Strategy,
            useValue: new Default(process.env.TEST_TMPDIR, "http://insteadof")
          },
          {
            provide: STORAGE_OPTIONS,
            useValue: {}
          }
        ]
      }).compile();
      storageService = module.get(StorageService);

      const [insertedObj] = await storageService.insert([
        {
          _id: new ObjectId(),
          name: "name",
          url: "url",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 100 * MB
          }
        }
      ]);

      expect(insertedObj.content.size).toEqual(100 * MB);
    });

    beforeEach(async () => {
      storageObjects = [
        {
          _id: new ObjectId(),
          name: "name",
          url: "url",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 4.5 * MB
          }
        },
        {
          _id: new ObjectId(),
          name: "name2",
          url: "url2",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 4.5 * MB
          }
        }
      ];
      await storageService.insertMany(storageObjects);
    });

    describe("insert", () => {
      it("should insert if it won't exceed the limit", async () => {
        const storageObject = {
          _id: new ObjectId(),
          name: "name3",
          url: "url",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 1 * MB
          }
        };

        const [insertedObj] = await storageService.insert([storageObject]);
        expect(insertedObj._id).toEqual(storageObject._id);
      });

      it("should not insert if it exceed the limit", async () => {
        const storageObject = {
          _id: new ObjectId(),
          name: "name3",
          url: "url",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 1.1 * MB
          }
        };

        await storageService.insertMany([storageObject]).catch(e => {
          expect(e).toEqual(new Error("Total storage object size limit exceeded"));
        });
      });
    });

    describe("update", () => {
      it("should update if it won't exceed the limit", async () => {
        storageObjects[0].content.size = 5.5 * MB;

        const updatedObj = await storageService.update(storageObjects[0]._id, storageObjects[0]);
        expect(updatedObj.content.size).toEqual(5.5 * MB);
      });

      it("should not update if it exceed the limit", async () => {
        storageObjects[0].content.size = 5.6 * MB;

        await storageService.update(storageObjects[0]._id, storageObjects[0]).catch(e => {
          expect(e).toEqual(new Error("Total storage object size limit exceeded"));
        });
      });
    });
  });
});
