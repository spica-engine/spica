import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {OBJECTID_STRING, OBJECT_ID, DATE_TIME} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";

describe("Expression Write Rule Type Construction", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;

  const HASH_SECRET = "test-hash-secret-123";
  const ENCRYPTION_SECRET = "01234567890123456789012345678901";

  let bucketId: string;

  const ALICE_DATE = "2024-02-15T00:00:00.000Z";
  const BOB_DATE = "2024-09-10T00:00:00.000Z";

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, OBJECTID_STRING, DATE_TIME],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        CoreTestingModule,
        PassportTestingModule.initialize({
          overriddenStrategyType: "USER"
        }),
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
    app.use(Middlewares.MergePatchJsonParser(10));
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  async function createBucket(writeRule: string) {
    bucketId = new ObjectId().toHexString();

    await req.post("/bucket", {
      _id: bucketId,
      title: "Write Rule Bucket",
      description: "Bucket with typed write rules",
      icon: "settings",
      primary: "name",
      readOnly: false,
      acl: {
        write: writeRule,
        read: "true==true"
      },
      properties: {
        name: {type: "string", title: "Name"},
        password: {type: "hash", title: "Password"},
        secret: {type: "encrypted", title: "Secret"},
        created: {type: "date", title: "Created"}
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Write rules with date field
  // ---------------------------------------------------------------------------
  describe("with date field in write rule expression", () => {
    beforeEach(async () => {
      await createBucket(`document.created == "${ALICE_DATE}"`);
    });

    it("should allow insert when date matches the rule", async () => {
      const res = await req.post(
        `/bucket/${bucketId}/data`,
        {name: "alice", password: "pass1", secret: "sec1", created: ALICE_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe("alice");
    });

    it("should reject insert when date does not match the rule", async () => {
      const res = await req.post(
        `/bucket/${bucketId}/data`,
        {name: "bob", password: "pass2", secret: "sec2", created: BOB_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("ACL rules has rejected this operation.");
    });

    it("should allow update when date matches the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "alice",
        password: "pass1",
        secret: "sec1",
        created: ALICE_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.put(
        `/bucket/${bucketId}/data/${docId}`,
        {name: "alice-updated", password: "pass1", secret: "sec1", created: ALICE_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe("alice-updated");
    });

    it("should reject update when date does not match the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "bob",
        password: "pass2",
        secret: "sec2",
        created: BOB_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.put(
        `/bucket/${bucketId}/data/${docId}`,
        {name: "bob-updated", password: "pass2", secret: "sec2", created: BOB_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(401);
    });

    it("should allow delete when document date matches the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "alice",
        password: "pass1",
        secret: "sec1",
        created: ALICE_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.delete(`/bucket/${bucketId}/data/${docId}`, undefined, {
        Authorization: "USER test"
      });
      expect(res.statusCode).toBe(204);
    });

    it("should reject delete when document date does not match the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "bob",
        password: "pass2",
        secret: "sec2",
        created: BOB_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.delete(`/bucket/${bucketId}/data/${docId}`, undefined, {
        Authorization: "USER test"
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // Write rules with hash field
  // ---------------------------------------------------------------------------
  describe("with hash field in write rule expression", () => {
    beforeEach(async () => {
      await createBucket(`document.password == "pass_alice"`);
    });

    it("should allow insert when hash matches the rule", async () => {
      const res = await req.post(
        `/bucket/${bucketId}/data`,
        {name: "alice", password: "pass_alice", secret: "sec1", created: ALICE_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe("alice");
    });

    it("should reject insert when hash does not match the rule", async () => {
      const res = await req.post(
        `/bucket/${bucketId}/data`,
        {name: "bob", password: "pass_bob", secret: "sec2", created: BOB_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("ACL rules has rejected this operation.");
    });

    it("should allow update when hash matches the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "alice",
        password: "pass_alice",
        secret: "sec1",
        created: ALICE_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.put(
        `/bucket/${bucketId}/data/${docId}`,
        {name: "alice-updated", password: "pass_alice", secret: "sec1", created: ALICE_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(200);
    });

    it("should reject update when hash does not match the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "alice",
        password: "pass_alice",
        secret: "sec1",
        created: ALICE_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.put(
        `/bucket/${bucketId}/data/${docId}`,
        {name: "alice-updated", password: "wrong_password", secret: "sec1", created: ALICE_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(401);
    });

    it("should allow delete when document hash matches the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "alice",
        password: "pass_alice",
        secret: "sec1",
        created: ALICE_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.delete(`/bucket/${bucketId}/data/${docId}`, undefined, {
        Authorization: "USER test"
      });
      expect(res.statusCode).toBe(204);
    });

    it("should reject delete when document hash does not match the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "bob",
        password: "pass_bob",
        secret: "sec2",
        created: BOB_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.delete(`/bucket/${bucketId}/data/${docId}`, undefined, {
        Authorization: "USER test"
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // Write rules with encrypted field
  // ---------------------------------------------------------------------------
  describe("with encrypted field in write rule expression", () => {
    beforeEach(async () => {
      await createBucket(`document.secret == "sec_alice"`);
    });

    it("should allow insert when encrypted value matches the rule", async () => {
      const res = await req.post(
        `/bucket/${bucketId}/data`,
        {name: "alice", password: "pass1", secret: "sec_alice", created: ALICE_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe("alice");
    });

    it("should reject insert when encrypted value does not match the rule", async () => {
      const res = await req.post(
        `/bucket/${bucketId}/data`,
        {name: "bob", password: "pass2", secret: "sec_bob", created: BOB_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("ACL rules has rejected this operation.");
    });

    it("should allow update when encrypted value matches the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "alice",
        password: "pass1",
        secret: "sec_alice",
        created: ALICE_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.put(
        `/bucket/${bucketId}/data/${docId}`,
        {name: "alice-updated", password: "pass1", secret: "sec_alice", created: ALICE_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(200);
    });

    it("should reject update when encrypted value does not match the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "alice",
        password: "pass1",
        secret: "sec_alice",
        created: ALICE_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.put(
        `/bucket/${bucketId}/data/${docId}`,
        {name: "alice-updated", password: "pass1", secret: "wrong_secret", created: ALICE_DATE},
        {Authorization: "USER test"}
      );
      expect(res.statusCode).toBe(401);
    });

    it("should allow delete when document encrypted value matches the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "alice",
        password: "pass1",
        secret: "sec_alice",
        created: ALICE_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.delete(`/bucket/${bucketId}/data/${docId}`, undefined, {
        Authorization: "USER test"
      });
      expect(res.statusCode).toBe(204);
    });

    it("should reject delete when document encrypted value does not match the rule", async () => {
      const insertRes = await req.post(`/bucket/${bucketId}/data`, {
        name: "bob",
        password: "pass2",
        secret: "sec_bob",
        created: BOB_DATE
      });
      const docId = insertRes.body._id;

      const res = await req.delete(`/bucket/${bucketId}/data/${docId}`, undefined, {
        Authorization: "USER test"
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
