import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {StorageService} from "@spica-server/storage";
import {StorageObject} from "@spica-server/storage/src/body";
import {Default} from "@spica-server/storage/src/strategy/default";
import {Strategy} from "@spica-server/storage/src/strategy/strategy";
import {STORAGE_OPTIONS} from "@spica-server/storage/src/options";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

describe("Storage Service", () => {
  let module: TestingModule;
  let storageService: StorageService;
  let storageObject: StorageObject;
  let storageObjectId: ObjectId = new ObjectId("56cb91bdc3464f14678934ca");

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
  });

  afterEach(() => module.close());

  it("should add storage objects", async () => {
    await expectAsync(
      storageService.insertMany(
        Array.from(new Array(3), (val, index) => ({
          name: "name" + index,
          content: {
            data: Buffer.from("123"),
            type: index.toString()
          }
        }))
      )
    ).toBeResolved();
    return await expectAsync(
      storageService.getAll([], 30, 0, {_id: -1}).then(result => {
        Array.from(result.data).forEach((val, index) => {
          expect(val.name).toBe("name" + (result.data.length - 1 - index));
          expect(val.content.data).toBe(undefined);
          expect(val.content.type).toBe((result.data.length - 1 - index).toString());
        });
        return result;
      })
    );
  });

  it("should update storage object", async () => {
    await expectAsync(storageService.insertMany([storageObject])).toBeResolved();

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
    await expectAsync(storageService.updateOne(storageObjectId, updatedData)).toBeResolved();

    return await expectAsync(
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
    ).toBeResolved();
  });

  it("should delete single storage object", async () => {
    await expectAsync(storageService.insertMany([storageObject])).toBeResolved();
    await expectAsync(storageService.deleteOne(storageObjectId)).toBeResolved();
    return await expectAsync(storageService.get(storageObjectId)).toBeResolvedTo(null);
  });

  describe("sorts", () => {
    let storageObjects: StorageObject[];
    beforeEach(async () => {
      storageObjects = Array.from(new Array(3), (val, index) => ({
        name: "name" + (2 - index),
        content: {
          data: {} as Buffer,
          type: ""
        }
      }));
      await expectAsync(storageService.insertMany(storageObjects)).toBeResolved();
    });
    it("should sort storage objects descend by name", async () => {
      return await expectAsync(
        storageService.getAll([], 3, 0, {name: -1}).then(result => {
          expect(result.data[0].name).toBe("name2");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name0");
          return result;
        })
      ).toBeResolved();
    });
    it("should sort storage objects ascend by name", async () => {
      return await expectAsync(
        storageService.getAll([], 3, 0, {name: 1}).then(result => {
          expect(result.data[0].name).toBe("name0");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name2");
          return result;
        })
      ).toBeResolved();
    });
    it("should sort storage objects descend by date", async () => {
      return await expectAsync(
        storageService.getAll([], 3, 0, {_id: -1}).then(result => {
          expect(result.data[0].name).toBe("name0");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name2");
          return result;
        })
      ).toBeResolved();
    });
    it("should sort storage objects ascend by date", async () => {
      return await expectAsync(
        storageService.getAll([], 3, 0, {_id: 1}).then(result => {
          expect(result.data[0].name).toBe("name2");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name0");
          return result;
        })
      ).toBeResolved();
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

      const [insertedObj] = await storageService.insertMany([
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
          name: "name",
          url: "url",
          content: {
            data: Buffer.from(""),
            type: "text/plain",
            size: 1 * MB
          }
        };

        const [insertedObj] = await storageService.insertMany([storageObject]);
        expect(insertedObj._id).toEqual(storageObject._id);
      });

      it("should not insert if it exceed the limit", async () => {
        const storageObject = {
          _id: new ObjectId(),
          name: "name",
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

        const updatedObj = await storageService.updateOne(storageObjects[0]._id, storageObjects[0]);
        expect(updatedObj.content.size).toEqual(5.5 * MB);
      });

      it("should not update if it exceed the limit", async () => {
        storageObjects[0].content.size = 5.6 * MB;

        await storageService.updateOne(storageObjects[0]._id, storageObjects[0]).catch(e => {
          expect(e).toEqual(new Error("Total storage object size limit exceeded"));
        });
      });
    });
  });
});
