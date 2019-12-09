import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {Storage, StorageObject} from "./storage.service";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

describe("storage service", () => {
  let module: TestingModule;
  let storageService: Storage;
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
      imports: [DatabaseTestingModule.create()],
      providers: [
        Storage,
        {
          provide: String,
          useValue: ""
        }
      ]
    }).compile();
    storageService = module.get(Storage);
  });

  afterAll(async () => {
    return await module.close();
  });

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
      storageService.getAll(30, 0, {_id: -1}).then(result => {
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
      _id: new ObjectId("56cb91bdc3464f14678934ca"),
      name: "new name",
      url: "new_url",
      content: {
        data: Buffer.from("cba"),
        type: "newtype",
        size: 10
      }
    };
    await expectAsync(storageService.updateOne(updatedData)).toBeResolved();

    return await expectAsync(
      storageService.get(updatedData._id as ObjectId).then(result => {
        expect(result).toEqual({
          _id: new ObjectId("56cb91bdc3464f14678934ca"),
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
        storageService.getAll(3, 0, {name: -1}).then(result => {
          expect(result.data[0].name).toBe("name2");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name0");
          return result;
        })
      ).toBeResolved();
    });
    it("should sort storage objects ascend by name", async () => {
      return await expectAsync(
        storageService.getAll(3, 0, {name: 1}).then(result => {
          expect(result.data[0].name).toBe("name0");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name2");
          return result;
        })
      ).toBeResolved();
    });
    it("should sort storage objects descend by date", async () => {
      return await expectAsync(
        storageService.getAll(3, 0, {_id: -1}).then(result => {
          expect(result.data[0].name).toBe("name0");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name2");
          return result;
        })
      ).toBeResolved();
    });
    it("should sort storage objects ascend by date", async () => {
      return await expectAsync(
        storageService.getAll(3, 0, {_id: 1}).then(result => {
          expect(result.data[0].name).toBe("name2");
          expect(result.data[1].name).toBe("name1");
          expect(result.data[2].name).toBe("name0");
          return result;
        })
      ).toBeResolved();
    });
  });
});
