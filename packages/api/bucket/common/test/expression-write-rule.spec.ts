import {contractSuite} from "@spica-server/database-testing";
import {Request} from "@spica-server/core-testing";
import {BucketApp, startBucketApp} from "../../test/support/bucket-app";

contractSuite("Expression Write Rule Type Construction", engine => {
  let api: BucketApp;
  let req: Request;
  let key: "_id" | "id";

  const HASH_SECRET = "test-hash-secret-123";
  const ENCRYPTION_SECRET = "01234567890123456789012345678901";

  let bucketId: string;

  const ALICE_DATE = "2024-02-15T00:00:00.000Z";
  const BOB_DATE = "2024-09-10T00:00:00.000Z";

  beforeEach(async () => {
    api = await startBucketApp(
      engine,
      {hashSecret: HASH_SECRET, encryptionSecret: ENCRYPTION_SECRET},
      {passport: {overriddenStrategyType: "USER"}, rejectOnError: false}
    );
    req = api.req;
    key = api.keyField;
  });

  afterEach(() => api.close());

  async function createBucket(writeRule: string) {
    bucketId = (
      await api.createBucket(
        {
          name: {type: "string", title: "Name"},
          password: {type: "hash", title: "Password"},
          secret: {type: "encrypted", title: "Secret"},
          created: {type: "date", title: "Created"}
        },
        {
          title: "Write Rule Bucket",
          description: "Bucket with typed write rules",
          icon: "settings",
          acl: {write: writeRule, read: "true==true"}
        }
      )
    )._id;
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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

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
      const docId = insertRes.body[key];

      const res = await req.delete(`/bucket/${bucketId}/data/${docId}`, undefined, {
        Authorization: "USER test"
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
