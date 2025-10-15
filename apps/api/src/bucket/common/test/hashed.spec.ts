import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {OBJECTID_STRING, OBJECT_ID, DATE_TIME} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId, DatabaseService} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {hashValue} from "../src/hash";

describe("Hashed Field", () => {
  let app: INestApplication;
  let req: Request;
  let database: DatabaseService;
  let module: TestingModule;

  const HASHING_KEY = "test-hashing-key-123";
  let bucketId: string;

  function hash(value: string): string {
    return hashValue(value, HASHING_KEY);
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, OBJECTID_STRING, DATE_TIME],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          history: false,
          realtime: false,
          cache: false,
          graphql: false,
          hashingKey: HASHING_KEY
        })
      ]
    }).compile();

    module.enableShutdownHooks();
    app = module.createNestApplication();
    req = module.get(Request);
    database = module.get(DatabaseService);
    app.use(Middlewares.MergePatchJsonParser(10));
    await app.listen(req.socket);

    // Create a bucket with hashed field
    bucketId = new ObjectId().toHexString();
    const bucket = {
      _id: bucketId,
      title: "User Bucket",
      description: "Bucket with hashed password field",
      icon: "person",
      primary: "username",
      readOnly: false,
      acl: {write: "true==true", read: "true==true"},
      properties: {
        username: {
          type: "string",
          title: "Username"
        },
        password: {
          type: "hashed",
          title: "Password"
        },
        age: {
          type: "number",
          title: "Age"
        }
      }
    };

    await req.post("/bucket", bucket);
  });

  afterEach(() => app.close());

  describe("Write Operations - Field value will be stored as hashed", () => {
    it("should hash password on insert", async () => {
      const document = {
        username: "john_doe",
        password: "mysecretpassword",
        age: 30
      };

      const response = await req.post(`/bucket/${bucketId}/data`, document);
      const insertedDoc = response.body;

      const dbDoc = await database
        .collection(`bucket_${bucketId}`)
        .findOne({_id: new ObjectId(insertedDoc._id)});

      expect(dbDoc).toMatchObject({
        username: "john_doe",
        password: hash("mysecretpassword"),
        age: 30
      });
      expect(dbDoc.password).not.toBe("mysecretpassword");
    });

    it("should hash password on replace", async () => {
      // Insert initial document
      const initialDoc = {
        username: "jane_doe",
        password: "oldpassword",
        age: 25
      };
      const insertResponse = await req.post(`/bucket/${bucketId}/data`, initialDoc);
      const documentId = insertResponse.body._id;

      // Replace document
      const updatedDoc = {
        username: "jane_updated",
        password: "newpassword",
        age: 26
      };
      await req.put(`/bucket/${bucketId}/data/${documentId}`, updatedDoc);

      const dbDoc = await database
        .collection(`bucket_${bucketId}`)
        .findOne({_id: new ObjectId(documentId)});

      expect(dbDoc).toMatchObject({
        username: "jane_updated",
        password: hash("newpassword"),
        age: 26
      });
      expect(dbDoc.password).not.toBe("newpassword");
    });

    it("should hash password on patch", async () => {
      // Insert initial document
      const initialDoc = {
        username: "bob_smith",
        password: "initialpassword",
        age: 35
      };
      const insertResponse = await req.post(`/bucket/${bucketId}/data`, initialDoc);
      const documentId = insertResponse.body._id;

      // Patch document
      const patch = {
        password: "patchedpassword"
      };
      await req.patch(`/bucket/${bucketId}/data/${documentId}`, patch);

      const dbDoc = await database
        .collection(`bucket_${bucketId}`)
        .findOne({_id: new ObjectId(documentId)});

      expect(dbDoc).toMatchObject({
        username: "bob_smith",
        password: hash("patchedpassword"),
        age: 35
      });
      expect(dbDoc.password).not.toBe("patchedpassword");
    });
  });

  describe("Read Operations - Find request returns hashed data", () => {
    beforeEach(async () => {
      await req.post(`/bucket/${bucketId}/data`, {
        username: "user1",
        password: "password123",
        age: 25
      });

      await req.post(`/bucket/${bucketId}/data`, {
        username: "user2",
        password: "password456",
        age: 30
      });
    });

    it("should return documents with hashed passwords", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {});
      const docs = response.body;

      const user1 = docs.find(d => d.username === "user1");
      const user2 = docs.find(d => d.username === "user2");

      expect(user1).toMatchObject({
        username: "user1",
        password: hash("password123"),
        age: 25
      });

      expect(user2).toMatchObject({
        username: "user2",
        password: hash("password456"),
        age: 30
      });
    });
  });

  describe("Filter Operations - Filter should work with hashed fields", () => {
    beforeEach(async () => {
      // Insert test documents
      await req.post(`/bucket/${bucketId}/data`, {
        username: "alice",
        password: "alicepass",
        age: 28
      });

      await req.post(`/bucket/${bucketId}/data`, {
        username: "bob",
        password: "bobpass",
        age: 32
      });

      await req.post(`/bucket/${bucketId}/data`, {
        username: "charlie",
        password: "charliepass",
        age: 45
      });
    });

    it("should filter by hashed field using plain text value", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({password: "bobpass"})
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        username: "bob",
        password: hash("bobpass"),
        age: 32
      });
    });

    it("should filter with $in operator on hashed field", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({
          password: {$in: ["alicepass", "charliepass"]}
        })
      });

      expect(response.body.length).toBe(2);
      const usernames = response.body.map(doc => doc.username).sort();
      expect(usernames).toEqual(["alice", "charlie"]);
    });

    it("should filter with $eq operator on hashed field", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({
          password: {$eq: "alicepass"}
        })
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        username: "alice",
        password: hash("alicepass"),
        age: 28
      });
    });

    it("should combine hashed field filter with non-hashed field filter", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({
          password: "bobpass",
          age: {$lte: 30}
        })
      });

      expect(response.body.length).toBe(0);
    });

    it("should return empty array when filter does not match", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({password: "wrongpassword"})
      });

      expect(response.body.length).toBe(0);
    });
  });
});
