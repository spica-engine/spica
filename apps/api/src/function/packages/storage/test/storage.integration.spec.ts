import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {CoreTestingModule} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {StorageModule} from "@spica-server/storage";
import * as Storage from "@spica-devkit/storage";
import {BatchModule} from "@spica-server/batch";

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
          defaultPath: process.env.TEST_TMPDIR
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
        url: `${PUBLIC_URL}/storage/${getAllResponse[0]._id}/view`,
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
          url: `${PUBLIC_URL}/storage/${getAllResponse.data[0]._id}/view`,
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
      url: `${PUBLIC_URL}/storage/${storageObj._id}/view`,
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
      url: `${PUBLIC_URL}/storage/${insertedObject._id}/view`,
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
        url: `${PUBLIC_URL}/storage/${insertedObjects[0]._id}/view`,
        content: {
          size: 5,
          type: "text/plain"
        }
      },
      {
        _id: insertedObjects[1]._id,
        name: "test2.json",
        url: `${PUBLIC_URL}/storage/${insertedObjects[1]._id}/view`,
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
      url: `${PUBLIC_URL}/storage/${insertedObj._id}/view`,
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
      url: `${PUBLIC_URL}/storage/${insertedObj._id}/view`,
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
});
