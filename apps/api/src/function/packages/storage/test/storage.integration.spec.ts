import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica/core";
import {DatabaseTestingModule} from "@spica/database";
import {CoreTestingModule} from "@spica/core";
import {PassportTestingModule} from "@spica/api/src/passport/testing";
import {StorageModule} from "@spica/api/src/storage";
import * as Storage from "@spica-devkit/storage";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20_000;

jasmine.getEnv().allowRespy(true);

const PORT = 3001;
const PUBLIC_URL = `http://localhost:${PORT}`;

describe("Storage", () => {
  let module: TestingModule;
  let app: INestApplication;
  let storageObject;

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
        CoreTestingModule
      ]
    }).compile();
    app = module.createNestApplication();
    await app.listen(PORT);

    storageObject = {
      contentType: "text/plain",
      name: "test.txt",
      data: Buffer.from("spica")
    };

    Storage.initialize({identity: "token", publicUrl: PUBLIC_URL});

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__objectid__" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("should get all", async () => {
    await Storage.insert(storageObject);

    const getAllResponse = await Storage.getAll();
    expect(getAllResponse).toEqual([
      {
        _id: "__objectid__",
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
          _id: "__objectid__",
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
      _id: "__objectid__",
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
    expect(insertedObject).toEqual(expectedObj);

    const existing = await Storage.get(insertedObject._id);
    expect(existing).toEqual(expectedObj);
  });

  it("should insert many", async () => {
    const insertedObjects = await Storage.insertMany([
      storageObject,
      {...storageObject, name: "test2.txt"}
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
        name: "test2.txt",
        url: `${PUBLIC_URL}/storage/${insertedObjects[1]._id}/view`,
        content: {
          size: 5,
          type: "text/plain"
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

  it("should download", async done => {
    const insertedObj = await Storage.insert(storageObject);

    const obj: any = await Storage.download(insertedObj._id);

    const chunks = [];
    obj.on("data", chunk => chunks.push(chunk));
    obj.on("end", () => {
      expect(chunks.toString()).toEqual("spica");
      done();
    });
  });
});
