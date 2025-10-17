import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule, hash} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {
  OBJECTID_STRING,
  OBJECT_ID,
  DATE_TIME,
  createHashFormat
} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId, DatabaseService} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("Hash Field", () => {
  let app: INestApplication;
  let req: Request;
  let database: DatabaseService;
  let module: TestingModule;

  const HASH_SECRET = "test-hash-secret-123";
  let bucketId: string;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, OBJECTID_STRING, DATE_TIME, createHashFormat(HASH_SECRET)],
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
          hashSecret: HASH_SECRET
        })
      ]
    }).compile();

    module.enableShutdownHooks();
    app = module.createNestApplication();
    req = module.get(Request);
    database = module.get(DatabaseService);
    app.use(Middlewares.MergePatchJsonParser(10));
    await app.listen(req.socket);

    // Create a bucket with hash field
    bucketId = new ObjectId().toHexString();
    const bucket = {
      _id: bucketId,
      title: "User Bucket",
      description: "Bucket with hash password field",
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
          type: "hash",
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

  describe("Write Operations - Field value will be stored as hash", () => {
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
        password: "825f4c68bab8ef1a7f11ef9426c8e0f6d860267f71cef3aeaccbdcf037237754",
        age: 30
      });
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
        password: "24c65f4d6692a34b63050b6e116d8adf9b2469c8c7172397ddee7b9eeda5f29a",
        age: 26
      });
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
        password: "b320e73558e1bacf17be988e4ab050ecea799aff631b54e58afdea4482d5839f",
        age: 35
      });
    });
  });

  describe("Read Operations - Find request returns hash data", () => {
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

    it("should return documents with hash passwords", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {});
      const docs = response.body;

      const user1 = docs.find(d => d.username === "user1");
      const user2 = docs.find(d => d.username === "user2");

      expect(user1).toMatchObject({
        username: "user1",
        password: "489b20c2a40cafadca5152412b5fd2c277a309f70da2d1c26099938f4427285a",
        age: 25
      });

      expect(user2).toMatchObject({
        username: "user2",
        password: "41b5b2d2d22a95e6102730a4a80c5b5695fd3bd614e63410443434277acc57c6",
        age: 30
      });
    });
  });

  describe("Filter Operations - Filter should work with hash fields", () => {
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

    it("should filter by hash field using plain text value", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({password: "bobpass"})
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        username: "bob",
        password: "689ebe21fda952729d34c56e22d876c9fa8230ea70434cc5e117f2044e83fe94",
        age: 32
      });
    });

    it("should filter with $in operator on hash field", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({
          password: {$in: ["alicepass", "charliepass"]}
        })
      });

      expect(response.body.length).toBe(2);
      const usernames = response.body.map(doc => doc.username).sort();
      expect(usernames).toEqual(["alice", "charlie"]);
    });

    it("should filter with $eq operator on hash field", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({
          password: {$eq: "alicepass"}
        })
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        username: "alice",
        password: "02b906806b7c66f6f196731e102f46d56d96738450dc69f86a7f67cd8577c0ac",
        age: 28
      });
    });

    it("should combine hash field filter with non-hash field filter", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({
          password: "bobpass",
          age: {$gte: 30}
        })
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        username: "bob",
        password: "689ebe21fda952729d34c56e22d876c9fa8230ea70434cc5e117f2044e83fe94",
        age: 32
      });
    });

    it("should return empty array when filter does not match", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({password: "wrongpassword"})
      });

      expect(response.body.length).toBe(0);
    });
  });
});
