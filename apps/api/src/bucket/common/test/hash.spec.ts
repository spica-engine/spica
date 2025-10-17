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
  let bucketId2: string;
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
    bucketId2 = new ObjectId().toHexString();

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
    const bucket2 = {
      _id: bucketId2,
      title: "User Bucket2",
      description: "Bucket with nested hash password field",
      icon: "person",
      primary: "username",
      readOnly: false,
      acl: {write: "true==true", read: "true==true"},
      properties: {
        username: {
          type: "string",
          title: "Username"
        },
        email: {
          type: "string",
          title: "Email"
        },
        user: {
          type: "object",
          title: "User",
          properties: {
            name: {
              type: "string",
              title: "Name"
            },
            surname: {
              type: "string",
              title: "Surname"
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
        }
      }
    };

    await req.post("/bucket", bucket);
    await req.post("/bucket", bucket2);
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
        password: "1787bc90cb1d226e67065da0ae7ce8af44c7ed7b689c951ae00f590f9a6d794a",
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
        password: "ccdc74486930c5a0bfef0f296a7ccd9720606b4d50dbee3116e47bef65316ea2",
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
        password: "7607df5f375b3c5da191f6d052aa7d1f43ea28c6f8d5e5460898f0f7eaf854c9",
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
        password: "142fec0c8e7a398e198660cf228c7158039dd839c913dc37bcc53e1e3cdafed7",
        age: 25
      });

      expect(user2).toMatchObject({
        username: "user2",
        password: "f9414d8b2d69d0341a72d3e8a1d1f5cd17e0bde5697603e362e12a0f80d2859a",
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
        password: "a21a300c2bf7a71d840c9aff3e0b9f3c38e7fb7f6a299a96f434178087616bb8",
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
        password: "f36835b0ac86db4982ae60b3bf5f8bd3eff02c83cb4324f8140184222867f42d",
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
        password: "a21a300c2bf7a71d840c9aff3e0b9f3c38e7fb7f6a299a96f434178087616bb8",
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

  describe("should hash nested fields", () => {
    beforeEach(async () => {
      await req.post(`/bucket/${bucketId2}/data`, {
        username: "alice123",
        email: "alice@example.com",
        user: {
          name: "Alice",
          surname: "Wonderland",
          password: "alicepass",
          age: 28
        }
      });
    });

    it("should hash nested object field", async () => {
      const response = await req.get(`/bucket/${bucketId2}/data`, {
        filter: JSON.stringify({"user.password": "alicepass"})
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        username: "alice123",
        email: "alice@example.com",
        user: {
          name: "Alice",
          surname: "Wonderland",
          password: "f36835b0ac86db4982ae60b3bf5f8bd3eff02c83cb4324f8140184222867f42d",
          age: 28
        }
      });
    });
  });
});
