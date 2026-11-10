import {contractSuite} from "@spica-server/database-testing";
import {Request} from "@spica-server/core-testing";
import {BucketApp, startBucketApp} from "../../test/support/bucket-app";

contractSuite("Expression Read Rule Type Construction", engine => {
  let api: BucketApp;
  let req: Request;
  let key: "_id" | "id";

  const HASH_SECRET = "test-hash-secret-123";
  const ENCRYPTION_SECRET = "01234567890123456789012345678901";

  beforeEach(async () => {
    api = await startBucketApp(
      engine,
      {hashSecret: HASH_SECRET, encryptionSecret: ENCRYPTION_SECRET},
      {passport: {overriddenStrategyType: "USER"}}
    );
    req = api.req;
    key = api.keyField;
  });

  afterEach(() => api.close());

  let bucketId: string;

  const ALICE_DATE = "2024-02-15T00:00:00.000Z";
  const BOB_DATE = "2024-09-10T00:00:00.000Z";

  const PROPERTIES = {
    name: {type: "string", title: "Name"},
    password: {type: "hash", title: "Password"},
    secret: {type: "encrypted", title: "Secret"},
    created: {type: "date", title: "Created"}
  };

  async function createBucketAndSeed(acl: {read: string; write: string}) {
    bucketId = (
      await api.createBucket(PROPERTIES, {
        title: "Rule Bucket",
        description: "Bucket with hash, encrypted, date fields",
        icon: "settings",
        acl
      })
    )._id;

    await req.post(`/bucket/${bucketId}/data`, {
      name: "alice",
      password: "pass_alice",
      secret: "sec_alice",
      created: ALICE_DATE
    });

    await req.post(`/bucket/${bucketId}/data`, {
      name: "bob",
      password: "pass_bob",
      secret: "sec_bob",
      created: BOB_DATE
    });
  }

  // ---------------------------------------------------------------------------
  // Document-level read rules
  // ---------------------------------------------------------------------------
  describe("document-level read rules", () => {
    describe("with date field in rule expression", () => {
      beforeEach(async () => {
        await createBucketAndSeed({
          read: `document.created == "${ALICE_DATE}"`,
          write: "true==true"
        });
      });

      it("should only return documents matching the date rule", async () => {
        const res = await req.get(`/bucket/${bucketId}/data`, {}, {Authorization: "USER test"});
        expect(res.body.length).toBe(1);
        expect(res.body[0].name).toBe("alice");
      });
    });

    describe("with hash field in rule expression", () => {
      beforeEach(async () => {
        await createBucketAndSeed({
          read: `document.password == "pass_alice"`,
          write: "true==true"
        });
      });

      it("should only return documents matching the hash rule", async () => {
        const res = await req.get(`/bucket/${bucketId}/data`, {}, {Authorization: "USER test"});
        expect(res.body.length).toBe(1);
        expect(res.body[0].name).toBe("alice");
      });
    });

    describe("with encrypted field in rule expression", () => {
      beforeEach(async () => {
        await createBucketAndSeed({
          read: `document.secret == "sec_alice"`,
          write: "true==true"
        });
      });

      it("should only return documents matching the encrypted rule", async () => {
        const res = await req.get(`/bucket/${bucketId}/data`, {}, {Authorization: "USER test"});
        expect(res.body.length).toBe(1);
        expect(res.body[0].name).toBe("alice");
      });
    });

    describe("with combined typed fields in rule expression", () => {
      beforeEach(async () => {
        await createBucketAndSeed({
          read: `document.created == "${ALICE_DATE}" && document.password == "pass_alice"`,
          write: "true==true"
        });
      });

      it("should only return documents matching all typed conditions", async () => {
        const res = await req.get(`/bucket/${bucketId}/data`, {}, {Authorization: "USER test"});
        expect(res.body.length).toBe(1);
        expect(res.body[0].name).toBe("alice");
      });
    });

    describe("with wrong value in typed rule expression", () => {
      beforeEach(async () => {
        await createBucketAndSeed({
          read: `document.password == "wrong_password"`,
          write: "true==true"
        });
      });

      it("should return no documents when rule value does not match any", async () => {
        const res = await req.get(`/bucket/${bucketId}/data`, {}, {Authorization: "USER test"});
        expect(res.body.length).toBe(0);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Field-level ACL rules
  // ---------------------------------------------------------------------------
  describe("field-level ACL rules", () => {
    async function createBucketWithFieldAcl(fieldAclExpression: string) {
      bucketId = (
        await api.createBucket(
          {...PROPERTIES, name: {type: "string", title: "Name", acl: fieldAclExpression}},
          {
            title: "Field ACL Bucket",
            description: "Bucket with field-level ACL using typed fields",
            icon: "settings",
            acl: {write: "true==true", read: "true==true"}
          }
        )
      )._id;

      await req.post(`/bucket/${bucketId}/data`, {
        name: "alice",
        password: "pass_alice",
        secret: "sec_alice",
        created: ALICE_DATE
      });

      await req.post(`/bucket/${bucketId}/data`, {
        name: "bob",
        password: "pass_bob",
        secret: "sec_bob",
        created: BOB_DATE
      });
    }

    describe("with date comparison in field ACL", () => {
      beforeEach(async () => {
        await createBucketWithFieldAcl(`document.created == "${ALICE_DATE}"`);
      });

      it("should show name field only for documents matching the date condition", async () => {
        const res = await req.get(`/bucket/${bucketId}/data`, {}, {Authorization: "USER test"});
        expect(res.body.length).toBe(2);

        const alice = res.body.find((d: any) => d.password && d.name === "alice");
        const bob = res.body.find((d: any) => !d.name);

        expect(alice).toBeTruthy();
        expect(alice.name).toBe("alice");

        expect(bob).toBeTruthy();
        expect(bob).not.toHaveProperty("name");
      });
    });

    describe("with hash comparison in field ACL", () => {
      beforeEach(async () => {
        await createBucketWithFieldAcl(`document.password == "pass_alice"`);
      });

      it("should show name field only for documents matching the hash condition", async () => {
        const res = await req.get(`/bucket/${bucketId}/data`, {}, {Authorization: "USER test"});
        expect(res.body.length).toBe(2);

        const alice = res.body.find((d: any) => d.name === "alice");
        const bob = res.body.find((d: any) => !d.name);

        expect(alice).toBeTruthy();
        expect(alice.name).toBe("alice");

        expect(bob).toBeTruthy();
        expect(bob).not.toHaveProperty("name");
      });
    });

    describe("with encrypted comparison in field ACL", () => {
      beforeEach(async () => {
        await createBucketWithFieldAcl(`document.secret == "sec_alice"`);
      });

      it("should show name field only for documents matching the encrypted condition", async () => {
        const res = await req.get(`/bucket/${bucketId}/data`, {}, {Authorization: "USER test"});
        expect(res.body.length).toBe(2);

        const alice = res.body.find((d: any) => d.name === "alice");
        const bob = res.body.find((d: any) => !d.name);

        expect(alice).toBeTruthy();
        expect(alice.name).toBe("alice");

        expect(bob).toBeTruthy();
        expect(bob).not.toHaveProperty("name");
      });
    });
  });
});
