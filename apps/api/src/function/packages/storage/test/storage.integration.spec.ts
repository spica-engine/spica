import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {CoreTestingModule} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {StorageModule} from "@spica-server/storage";
import * as Storage from "@spica-devkit/storage";
import {BatchModule} from "@spica-server/batch";
import * as fs from "fs";
import * as path from "path";

const PORT = 3001;
const PUBLIC_URL = `http://localhost:${PORT}`;

describe("Storage", () => {
  let module: TestingModule;
  let app: INestApplication;
  let storageObject;
  let storageObject2;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot(),
        DatabaseTestingModule.replicaSet(),
        PassportTestingModule.initialize({overriddenStrategyType: "identity"}),
        StorageModule.forRoot({
          objectSizeLimit: 10,
          strategy: "default",
          defaultPublicUrl: PUBLIC_URL,
          defaultPath: process.env.TEST_TMPDIR,
          resumableUploadExpiresIn: 60
        }),
        CoreTestingModule,
        BatchModule.forRoot({port: PORT.toString()})
      ]
    }).compile();
    app = module.createNestApplication();
    await app.listen(PORT);

    storageObject = {
      contentType: "text/plain",
      name: "test.txt",
      data: Buffer.from("spica")
    };

    storageObject2 = {
      contentType: "text/plain",
      name: "test2.txt",
      data: Buffer.from("hello")
    };

    Storage.initialize({identity: "token", publicUrl: PUBLIC_URL});
  });

  afterEach(async () => {
    await app.close();
  });

  it("should get all", async () => {
    await Storage.insert(storageObject);

    const getAllResponse = await Storage.getAll();
    expect(getAllResponse).toEqual([
      {
        _id: getAllResponse[0]._id,
        name: "test.txt",
        url: `${PUBLIC_URL}/storage/test.txt/view`,
        content: {
          size: 5,
          type: "text/plain"
        }
      }
    ]);
  });

  it("should get all with paginate", async () => {
    await Storage.insert(storageObject);

    const getAllResponse = await Storage.getAll({paginate: true});
    expect(getAllResponse).toEqual({
      meta: {total: 1},
      data: [
        {
          _id: getAllResponse.data[0]._id,
          name: "test.txt",
          url: `${PUBLIC_URL}/storage/test.txt/view`,
          content: {
            size: 5,
            type: "text/plain"
          }
        }
      ]
    });
  });

  it("should get", async () => {
    const storageObj = await Storage.insert(storageObject);

    const getResponse = await Storage.get(storageObj._id);
    expect(getResponse).toEqual({
      _id: getResponse._id,
      name: "test.txt",
      url: `${PUBLIC_URL}/storage/test.txt/view`,
      content: {
        size: 5,
        type: "text/plain"
      }
    });
  });

  it("should insert", async () => {
    const insertedObject = await Storage.insert(storageObject);

    const expectedObj = {
      _id: insertedObject._id,
      name: "test.txt",
      url: `${PUBLIC_URL}/storage/test.txt/view`,
      content: {
        size: 5,
        type: "text/plain"
      }
    };
    expect(ObjectId.isValid(insertedObject._id)).toEqual(true);
    expect(insertedObject).toEqual(expectedObj);

    const existing = await Storage.get(insertedObject._id);
    expect(existing).toEqual(expectedObj);
  });

  it("should insert many", async () => {
    const insertedObjects = await Storage.insertMany([
      storageObject,
      {name: "test2.json", contentType: "application/json", data: "{}"}
    ]);

    const expectedObjects = [
      {
        _id: insertedObjects[0]._id,
        name: "test.txt",
        url: `${PUBLIC_URL}/storage/test.txt/view`,
        content: {
          size: 5,
          type: "text/plain"
        }
      },
      {
        _id: insertedObjects[1]._id,
        name: "test2.json",
        url: `${PUBLIC_URL}/storage/test2.json/view`,
        content: {
          size: 2,
          type: "application/json"
        }
      }
    ];
    expect(insertedObjects).toEqual(expectedObjects);

    const existings = await Storage.getAll();
    expect(existings).toEqual(expectedObjects);
  });

  it("should update", async () => {
    const insertedObj = await Storage.insert(storageObject);

    const updatedObject = {...storageObject, data: Buffer.from("not_spica")};

    const updateResponse = await Storage.update(insertedObj._id, updatedObject);

    const expectedObject = {
      _id: insertedObj._id,
      name: "test.txt",
      url: `${PUBLIC_URL}/storage/test.txt/view`,
      content: {
        size: 9,
        type: "text/plain"
      }
    };

    expect(updateResponse).toEqual(expectedObject);

    const existing = await Storage.get(insertedObj._id);
    expect(existing).toEqual(expectedObject);
  });

  it("should patch", async () => {
    const insertedObj = await Storage.insert(storageObject);

    const updateResponse = await Storage.updateMeta(insertedObj._id, {name: "updated_test.txt"});

    const expectedObject = {
      _id: insertedObj._id,
      name: "updated_test.txt",
      url: `${PUBLIC_URL}/storage/updated_test.txt/view`,
      content: {
        size: 5,
        type: "text/plain"
      }
    };

    expect(updateResponse).toEqual(expectedObject);

    const existing = await Storage.get(insertedObj._id);
    expect(existing).toEqual(expectedObject);
  });

  it("should remove", async () => {
    const insertedObj = await Storage.insert(storageObject);

    await Storage.remove(insertedObj._id);

    const existings = await Storage.getAll();
    expect(existings).toEqual([]);
  });

  it("should remove multiple storage objects", async () => {
    const insertedObjects = await Storage.insertMany([storageObject, storageObject2]);

    const response = await Storage.removeMany([...insertedObjects.map(i => i._id), "123"]);

    expect(response).toEqual({
      successes: [
        {
          request: `storage/${insertedObjects[0]._id}`,
          response: ""
        },
        {
          request: `storage/${insertedObjects[1]._id}`,
          response: ""
        }
      ],
      failures: [
        {
          request: "storage/123",
          response: {
            error: undefined,
            message: "Invalid id."
          }
        }
      ]
    });

    const existings = await Storage.getAll();

    expect(existings).toEqual([]);
  });

  it("should download", done => {
    Storage.insert(storageObject).then(insertedObj =>
      Storage.download(insertedObj._id).then((obj: any) => {
        const chunks = [];
        obj.on("data", chunk => chunks.push(chunk));
        obj.on("end", () => {
          expect(chunks.toString()).toEqual("spica");
          done();
        });
      })
    );
  });

  describe("Resumable Uploads", () => {
    afterEach(async () => {
      const tusUrlsPath = path.join(process.cwd(), "tus-urls.json");
      if (fs.existsSync(tusUrlsPath)) fs.unlinkSync(tusUrlsPath);
    });

    it("should resumable upload", done => {
      const onError = jest.fn();
      const onProgress = jest.fn();
      const onSuccess = jest.fn();

      Storage.insertResumable(storageObject, {}, onError, onProgress, onSuccess);

      setTimeout(() => {
        expect(onError).not.toHaveBeenCalled();
        expect(onProgress).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
        done();
      }, 1000);
    });

    it("should resumable upload with progress tracking for files", done => {
      const largeFile = {
        contentType: "application/octet-stream",
        name: "large_backend_file.bin",
        data: Buffer.from("x".repeat(1024 * 15))
      };

      const progressCalls = [];
      const onError = jest.fn();
      const onProgress = jest.fn((bytesUploaded, bytesTotal) => {
        progressCalls.push({bytesUploaded, bytesTotal});
      });
      const onSuccess = jest.fn();

      Storage.insertResumable(largeFile, {}, onError, onProgress, onSuccess);

      setTimeout(() => {
        expect(onError).not.toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
        expect(progressCalls.length).toBeGreaterThan(0);

        const finalProgress = progressCalls[progressCalls.length - 1];
        expect(finalProgress.bytesUploaded).toBe(finalProgress.bytesTotal);
        expect(finalProgress.bytesTotal).toBe(largeFile.data.length);

        done();
      }, 3000);
    });

    it("should resumable upload and verify file persistence in storage", done => {
      const backendFile = {
        contentType: "application/json",
        name: "backend_function_result.json",
        data: Buffer.from(
          JSON.stringify({
            functionId: "test_function_123",
            executionTime: Date.now(),
            result: "function execution completed",
            data: new Array(100).fill("backend_data").join("")
          })
        )
      };

      const onError = jest.fn();
      const onProgress = jest.fn();
      const onSuccess = jest.fn();

      Storage.insertResumable(backendFile, {}, onError, onProgress, onSuccess);

      setTimeout(async () => {
        expect(onError).not.toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();

        const allFiles = await Storage.getAll();
        const uploadedFile = allFiles.find(file => file.name === backendFile.name);

        expect(uploadedFile).toBeDefined();
        expect(uploadedFile.content.type).toBe("application/json");
        expect(uploadedFile.content.size).toBe(backendFile.data.length);

        const downloadStream = (await Storage.download(uploadedFile._id)) as NodeJS.ReadableStream;
        const chunks = [];

        downloadStream.on("data", chunk => chunks.push(chunk));
        downloadStream.on("end", () => {
          const content = JSON.parse(Buffer.concat(chunks).toString());
          expect(content.functionId).toBe("test_function_123");
          expect(content.result).toBe("function execution completed");
          done();
        });
      }, 2000);
    });

    it("should resumable upload with backend authorization headers", done => {
      const functionFile = {
        contentType: "text/plain",
        name: "authorized_function_upload.txt",
        data: Buffer.from("This file was uploaded by a Spica function with authorization")
      };

      const backendHeaders = {
        "X-Function-Id": "backend_function_456",
        "X-Execution-Context": "spica-backend",
        "X-Upload-Source": "function-devkit"
      };

      const onError = jest.fn();
      const onProgress = jest.fn();
      const onSuccess = jest.fn();

      Storage.insertResumable(functionFile, backendHeaders, onError, onProgress, onSuccess);

      setTimeout(async () => {
        expect(onError).not.toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();

        const allFiles = await Storage.getAll();
        const uploadedFile = allFiles.find(file => file.name === functionFile.name);

        expect(uploadedFile).toBeDefined();
        expect(uploadedFile.content.size).toBe(functionFile.data.length);

        done();
      }, 1500);
    });

    it("should resume upload if it was interrupted", async () => {
      const timestamp = Date.now();
      const testFile = {
        contentType: "application/octet-stream",
        name: `interrupted_test_${timestamp}.bin`,
        data: Buffer.from("x".repeat(1024 * 200)) // 200KB file
      };

      // Start upload and interrupt it
      let uploadInterrupted = false;
      await new Promise<void>(resolve => {
        const onProgress = (bytesUploaded, bytesTotal) => {
          if (bytesUploaded > 0 && bytesUploaded < bytesTotal && !uploadInterrupted) {
            uploadInterrupted = true;
            resolve();
          }
        };
        Storage.insertResumable(testFile, {}, jest.fn(), onProgress, jest.fn());
        setTimeout(() => {
          if (!uploadInterrupted) {
            uploadInterrupted = true;
            resolve();
          }
        }, 100);
      });
      expect(uploadInterrupted).toBe(true);

      // Resume upload
      let resumeDetected = false;
      await new Promise<void>((resolve, reject) => {
        const onProgress = (bytesUploaded, bytesTotal) => {
          if (bytesUploaded > 0 && !resumeDetected) {
            resumeDetected = true;
          }
        };
        const onSuccess = () => resolve();
        const onError = error => reject(error);
        Storage.insertResumable(testFile, {}, onError, onProgress, onSuccess);
      });
      expect(resumeDetected).toBe(true);

      const allFiles = await Storage.getAll();
      const uploadedFile = allFiles.find(f => f.name === testFile.name);
      expect(uploadedFile).toBeDefined();
      expect(uploadedFile).toMatchObject({
        name: testFile.name,
        content: {
          size: testFile.data.length,
          type: testFile.contentType
        }
      });
    }, 20000);
  });
});
