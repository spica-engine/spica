import {Test, TestingModule} from "@nestjs/testing";
import {StorageController} from "./storage.controller";
import {Storage} from "./storage.service";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {Binary} from "crypto";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

class MockRes {
  json(object: Object) {}
  header(key: String, val: String) {}
  end(data: any) {}
}

describe("Storage Controller", () => {
  let module: TestingModule;
  let storageService: Storage;
  let storageController: StorageController;
  let mockData;

  beforeEach(async () => {
    mockData = {
      meta: {count: 3},
      data: [
        {
          _id: new ObjectId("56cb91bdc3464f14678934ca"),
          url: "url1",
          content: {
            data: Buffer.from("1"),
            type: "text"
          }
        },
        {
          _id: new ObjectId("56cb91bdc3464f14678934cb"),
          url: "url2",
          content: {
            data: Buffer.from("2"),
            type: "text2"
          }
        },
        {
          _id: new ObjectId("56cb91bdc3464f14678934cc"),
          url: "url3",
          content: {
            data: Buffer.from("3"),
            type: "text3"
          }
        }
      ]
    };
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
      controllers: [StorageController],
      providers: [
        Storage,
        {
          provide: String,
          useValue: ""
        }
      ]
    }).compile();

    storageService = module.get(Storage);
    storageController = module.get(StorageController);
  });

  it("should return all storage objects", async () => {
    const getAllSpy = spyOn(storageService, "getAll").and.returnValue(Promise.resolve(mockData));
    return await expectAsync(
      storageController.findAll(3, 0, {}).then(result => {
        expect(getAllSpy).toHaveBeenCalledTimes(1);
        expect(getAllSpy).toHaveBeenCalledWith(3, 0, {});

        expect(result.data[0].url).toEqual("undefined/storage/56cb91bdc3464f14678934ca");
        expect(result.data[1].url).toEqual("undefined/storage/56cb91bdc3464f14678934cb");
        expect(result.data[2].url).toEqual("undefined/storage/56cb91bdc3464f14678934cc");

        return;
      })
    ).toBeResolved();
  });

  describe("get single storage object", () => {
    let mockRes;
    let jsonSpy;
    let headerSpy;
    let endSpy;
    beforeEach(() => {
      mockRes = new MockRes();
      jsonSpy = spyOn(mockRes, "json").and.callThrough();
      headerSpy = spyOn(mockRes, "header").and.callThrough();
      endSpy = spyOn(mockRes, "end").and.callThrough();
      spyOn(storageService, "get").and.returnValue(Promise.resolve(mockData.data[2]));
    });

    it("withMeta: false", async () => {
      await expectAsync(
        storageController
          .showOne(new ObjectId("56cb91bdc3464f14678934cc"), true, mockRes)
          .then(() => {
            expect(jsonSpy).toHaveBeenCalledTimes(1);
            expect(jsonSpy).toHaveBeenCalledWith({
              _id: new ObjectId("56cb91bdc3464f14678934cc"),
              url: "undefined/storage/56cb91bdc3464f14678934cc",
              content: {
                data: Buffer.from("3"),
                type: "text3"
              }
            });
          })
      ).toBeResolved();
    });

    it("withMeta: true", async () => {
      await expectAsync(
        storageController
          .showOne(new ObjectId("56cb91bdc3464f14678934cc"), false, mockRes)
          .then(() => {
            expect(headerSpy).toHaveBeenCalledTimes(1);
            expect(headerSpy).toHaveBeenCalledWith("Content-type", "text3");

            expect(endSpy).toHaveBeenCalledTimes(1);
            expect(endSpy).toHaveBeenCalledWith(Buffer.from("3"));
          })
      ).toBeResolved();
    });
  });

  it("should update storage object", async () => {
    const updatedData = {
      _id: new ObjectId("56cb91bdc3464f14678934cb"),
      content: {
        data: Buffer.from("new data"),
        type: "newtype",
        size: null
      }
    };
    const updateSpy = spyOn(storageService, "updateOne").and.returnValue(
      Promise.resolve(updatedData)
    );

    return await expectAsync(
      storageController.updateOne(updatedData).then(() => {
        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledWith({
          _id: new ObjectId("56cb91bdc3464f14678934cb"),
          content: {
            data: ((Buffer.from("new data") as any) as Binary).buffer,
            type: "newtype",
            size: ((Buffer.from("new data") as any) as Binary).buffer.byteLength
          }
        });
        return;
      })
    ).toBeResolved();
  });

  it("should insert storage objects", async () => {
    const newData = [
      {
        _id: new ObjectId("56cb91bdc3464f14678934ca"),
        name: "name",
        content: {
          data: Buffer.from("new data"),
          type: "newtype",
          size: null
        }
      },
      {
        _id: new ObjectId("56cb91bdc3464f14678934cb"),
        name: "name2",
        content: {
          data: Buffer.from("new data2"),
          type: "newtype2",
          size: null
        }
      },
      {
        _id: new ObjectId("56cb91bdc3464f14678934cc"),
        name: "name3",
        content: {
          data: Buffer.from("new data3"),
          type: "newtype3",
          size: null
        }
      }
    ];
    const insertSpy = spyOn(storageService, "insertMany").and.returnValue(Promise.resolve(newData));

    return await expectAsync(
      storageController.insertMany(newData).then(() => {
        expect(insertSpy).toHaveBeenCalledTimes(1);
        expect(insertSpy).toHaveBeenCalledWith([
          {
            name: "name",
            content: {
              data: ((Buffer.from("new data") as any) as Binary).buffer,
              type: "newtype",
              size: ((Buffer.from("new data") as any) as Binary).buffer.byteLength
            }
          },
          {
            name: "name2",
            content: {
              data: ((Buffer.from("new data2") as any) as Binary).buffer,
              type: "newtype2",
              size: ((Buffer.from("new data2") as any) as Binary).buffer.byteLength
            }
          },
          {
            name: "name3",
            content: {
              data: ((Buffer.from("new data3") as any) as Binary).buffer,
              type: "newtype3",
              size: ((Buffer.from("new data3") as any) as Binary).buffer.byteLength
            }
          }
        ]);
        return;
      })
    ).toBeResolved();
  });

  it("should delete single storage object", async () => {
    const deleteSpy = spyOn(storageController, "deleteOne").and.returnValue(
      Promise.resolve(undefined)
    );
    return await expectAsync(
      storageController.deleteOne(new ObjectId("56cb91bdc3464f14678934ca")).then(() => {
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith(new ObjectId("56cb91bdc3464f14678934ca"));
        return;
      })
    ).toBeResolvedTo(undefined);
  });
});
