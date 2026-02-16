import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {
  OBJECTID_STRING,
  OBJECT_ID,
  DATE_TIME,
  createHashFormat,
  createEncryptedFormat
} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId, DatabaseService} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("Encrypted Field", () => {
  let app: INestApplication;
  let req: Request;
  let database: DatabaseService;
  let module: TestingModule;

  // AES-256 requires exactly 32 bytes
  const ENCRYPTION_SECRET = "01234567890123456789012345678901";
  const HASH_SECRET = "test-hash-secret-123";

  let bucketId: string;
  let nestedBucketId: string;
  let mixedBucketId: string;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [
            OBJECT_ID,
            OBJECTID_STRING,
            DATE_TIME,
            createHashFormat(HASH_SECRET),
            createEncryptedFormat(ENCRYPTION_SECRET)
          ],
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
          hashSecret: HASH_SECRET,
          encryptionSecret: ENCRYPTION_SECRET
        })
      ]
    }).compile();

    module.enableShutdownHooks();
    app = module.createNestApplication();
    req = module.get(Request);
    database = module.get(DatabaseService);
    app.use(Middlewares.MergePatchJsonParser(10));
    await app.listen(req.socket);

    bucketId = new ObjectId().toHexString();
    nestedBucketId = new ObjectId().toHexString();
    mixedBucketId = new ObjectId().toHexString();

    const bucket = {
      _id: bucketId,
      title: "Secure Bucket",
      description: "Bucket with encrypted field",
      icon: "lock",
      primary: "label",
      readOnly: false,
      acl: {write: "true==true", read: "true==true"},
      properties: {
        label: {
          type: "string",
          title: "Label"
        },
        secret_note: {
          type: "encrypted",
          title: "Secret Note"
        },
        age: {
          type: "number",
          title: "Age"
        }
      }
    };

    const nestedBucket = {
      _id: nestedBucketId,
      title: "Nested Encrypted Bucket",
      description: "Bucket with nested encrypted field",
      icon: "lock",
      primary: "label",
      readOnly: false,
      acl: {write: "true==true", read: "true==true"},
      properties: {
        label: {
          type: "string",
          title: "Label"
        },
        credentials: {
          type: "object",
          title: "Credentials",
          properties: {
            username: {
              type: "string",
              title: "Username"
            },
            api_key: {
              type: "encrypted",
              title: "API Key"
            }
          }
        }
      }
    };

    const mixedBucket = {
      _id: mixedBucketId,
      title: "Mixed Bucket",
      description: "Bucket with both hash and encrypted fields",
      icon: "lock",
      primary: "name",
      readOnly: false,
      acl: {write: "true==true", read: "true==true"},
      properties: {
        name: {
          type: "string",
          title: "Name"
        },
        password: {
          type: "hash",
          title: "Password"
        },
        ssn: {
          type: "encrypted",
          title: "SSN"
        }
      }
    };

    await req.post("/bucket", bucket);
    await req.post("/bucket", nestedBucket);
    await req.post("/bucket", mixedBucket);
  });

  afterEach(() => app.close());

  describe("Write Operations - Field value is stored as encrypted object in DB", () => {
    it("should store encrypted object on insert", async () => {
      const document = {
        label: "doc1",
        secret_note: "my-secret-value",
        age: 30
      };

      const response = await req.post(`/bucket/${bucketId}/data`, document);
      const insertedDoc = response.body;

      const dbDoc = await database
        .collection(`bucket_${bucketId}`)
        .findOne({_id: new ObjectId(insertedDoc._id)});

      expect(dbDoc.label).toBe("doc1");
      expect(dbDoc.age).toBe(30);

      // DB should store encrypted object with iv, encrypted, authTag, and deterministic hash
      expect(dbDoc.secret_note).toBeDefined();
      expect(typeof dbDoc.secret_note).toBe("object");
      expect(dbDoc.secret_note.encrypted).toBeDefined();
      expect(dbDoc.secret_note.iv).toBeDefined();
      expect(dbDoc.secret_note.authTag).toBeDefined();
      expect(dbDoc.secret_note.hash).toBeDefined();
      expect(typeof dbDoc.secret_note.hash).toBe("string");
      expect(dbDoc.secret_note.hash).toHaveLength(64);
      // Must not store plaintext
      expect(dbDoc.secret_note.encrypted).not.toBe("my-secret-value");
    });

    it("should store encrypted object on replace", async () => {
      const initialDoc = {label: "doc-replace", secret_note: "old-secret", age: 25};
      const insertResponse = await req.post(`/bucket/${bucketId}/data`, initialDoc);
      const documentId = insertResponse.body._id;

      const updatedDoc = {label: "doc-replace", secret_note: "new-secret", age: 26};
      await req.put(`/bucket/${bucketId}/data/${documentId}`, updatedDoc);

      const dbDoc = await database
        .collection(`bucket_${bucketId}`)
        .findOne({_id: new ObjectId(documentId)});

      expect(typeof dbDoc.secret_note).toBe("object");
      expect(dbDoc.secret_note.encrypted).toBeDefined();
      expect(dbDoc.secret_note.iv).toBeDefined();
      expect(dbDoc.secret_note.authTag).toBeDefined();
    });

    it("should store encrypted object on patch", async () => {
      const initialDoc = {label: "doc-patch", secret_note: "initial-secret", age: 35};
      const insertResponse = await req.post(`/bucket/${bucketId}/data`, initialDoc);
      const documentId = insertResponse.body._id;

      await req.patch(`/bucket/${bucketId}/data/${documentId}`, {
        secret_note: "patched-secret"
      });

      const dbDoc = await database
        .collection(`bucket_${bucketId}`)
        .findOne({_id: new ObjectId(documentId)});

      expect(typeof dbDoc.secret_note).toBe("object");
      expect(dbDoc.secret_note.encrypted).toBeDefined();
      expect(dbDoc.secret_note.iv).toBeDefined();
      expect(dbDoc.secret_note.authTag).toBeDefined();
    });

    it("should store nested encrypted field as encrypted object", async () => {
      const document = {
        label: "nested-doc",
        credentials: {
          username: "admin",
          api_key: "sk-live-abc123"
        }
      };

      const response = await req.post(`/bucket/${nestedBucketId}/data`, document);
      const insertedDoc = response.body;

      const dbDoc = await database
        .collection(`bucket_${nestedBucketId}`)
        .findOne({_id: new ObjectId(insertedDoc._id)});

      expect(dbDoc.credentials.username).toBe("admin");
      expect(typeof dbDoc.credentials.api_key).toBe("object");
      expect(dbDoc.credentials.api_key.encrypted).toBeDefined();
      expect(dbDoc.credentials.api_key.iv).toBeDefined();
      expect(dbDoc.credentials.api_key.authTag).toBeDefined();
    });
  });

  describe("Read Operations - API returns decrypted plaintext", () => {
    beforeEach(async () => {
      await req.post(`/bucket/${bucketId}/data`, {
        label: "user1",
        secret_note: "secret-alpha",
        age: 25
      });

      await req.post(`/bucket/${bucketId}/data`, {
        label: "user2",
        secret_note: "secret-beta",
        age: 30
      });
    });

    it("should return decrypted values on find", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {});
      const docs = response.body;

      const user1 = docs.find(d => d.label === "user1");
      const user2 = docs.find(d => d.label === "user2");

      expect(user1.secret_note).toBe("secret-alpha");
      expect(user2.secret_note).toBe("secret-beta");
    });

    it("should return decrypted value on findOne", async () => {
      const insertResponse = await req.post(`/bucket/${bucketId}/data`, {
        label: "single",
        secret_note: "single-secret",
        age: 40
      });
      const docId = insertResponse.body._id;

      const response = await req.get(`/bucket/${bucketId}/data/${docId}`, {});

      expect(response.body.label).toBe("single");
      expect(response.body.secret_note).toBe("single-secret");
    });

    it("should return decrypted nested encrypted fields", async () => {
      const insertResponse = await req.post(`/bucket/${nestedBucketId}/data`, {
        label: "nested-read",
        credentials: {
          username: "admin",
          api_key: "sk-live-xyz789"
        }
      });
      const docId = insertResponse.body._id;

      const response = await req.get(`/bucket/${nestedBucketId}/data/${docId}`, {});

      expect(response.body.credentials.username).toBe("admin");
      expect(response.body.credentials.api_key).toBe("sk-live-xyz789");
    });
  });

  describe("Filter Operations - Encrypted field filters match via deterministic hash", () => {
    beforeEach(async () => {
      await req.post(`/bucket/${bucketId}/data`, {
        label: "alice",
        secret_note: "alice-secret",
        age: 28
      });

      await req.post(`/bucket/${bucketId}/data`, {
        label: "bob",
        secret_note: "bob-secret",
        age: 32
      });
    });

    it("should filter on encrypted field and return matching document", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({secret_note: "alice-secret"})
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].label).toBe("alice");
      expect(response.body[0].secret_note).toBe("alice-secret");
    });

    it("should keep non-encrypted filters alongside encrypted ones", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({secret_note: "alice-secret", age: 28})
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].label).toBe("alice");
    });

    it("should return no results when encrypted field filter does not match", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({secret_note: "nonexistent-secret"})
      });

      expect(response.body.length).toBe(0);
    });

    it("should filter encrypted field with $in operator", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({secret_note: {$in: ["alice-secret", "nonexistent"]}})
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].label).toBe("alice");
      expect(response.body[0].secret_note).toBe("alice-secret");
    });

    it("should handle $or with encrypted field filters", async () => {
      const response = await req.get(`/bucket/${bucketId}/data`, {
        filter: JSON.stringify({
          $or: [{secret_note: "alice-secret"}, {age: 32}]
        })
      });

      // Both clauses should match: alice via encrypted hash, bob via age
      expect(response.body.length).toBe(2);
    });
  });

  describe("Mixed hash and encrypted fields", () => {
    it("should handle both hash and encrypted fields correctly", async () => {
      const document = {
        name: "Jane",
        password: "my-password",
        ssn: "123-45-6789"
      };

      const response = await req.post(`/bucket/${mixedBucketId}/data`, document);
      const docId = response.body._id;

      // Check DB: password is hashed (string), ssn is encrypted (object)
      const dbDoc = await database
        .collection(`bucket_${mixedBucketId}`)
        .findOne({_id: new ObjectId(docId)});

      expect(typeof dbDoc.password).toBe("string");
      expect(dbDoc.password).not.toBe("my-password");

      expect(typeof dbDoc.ssn).toBe("object");
      expect(dbDoc.ssn.encrypted).toBeDefined();
      expect(dbDoc.ssn.iv).toBeDefined();
      expect(dbDoc.ssn.authTag).toBeDefined();
      expect(dbDoc.ssn.hash).toBeDefined();
      expect(typeof dbDoc.ssn.hash).toBe("string");
      expect(dbDoc.ssn.hash).toHaveLength(64);

      // Read: password stays hashed, ssn is decrypted
      const readResponse = await req.get(`/bucket/${mixedBucketId}/data/${docId}`, {});

      expect(typeof readResponse.body.password).toBe("string");
      expect(readResponse.body.password).not.toBe("my-password");
      expect(readResponse.body.ssn).toBe("123-45-6789");
    });
  });
});
