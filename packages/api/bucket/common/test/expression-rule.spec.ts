import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core-schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core-schema";
import {OBJECTID_STRING, OBJECT_ID, DATE_TIME} from "@spica-server/core-schema";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";

describe("Expression Read Rule Type Construction", () => {
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
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  async function createBucketAndSeed(acl: {read: string; write: string}) {
    bucketId = new ObjectId().toHexString();

    await req.post("/bucket", {
      _id: bucketId,
      title: "Rule Bucket",
      description: "Bucket with hash, encrypted, date fields",
      icon: "settings",
      primary: "name",
      readOnly: false,
      acl,
      properties: {
        name: {type: "string", title: "Name"},
        password: {type: "hash", title: "Password"},
        secret: {type: "encrypted", title: "Secret"},
        created: {type: "date", title: "Created"}
      }
    });

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
      bucketId = new ObjectId().toHexString();

      await req.post("/bucket", {
        _id: bucketId,
        title: "Field ACL Bucket",
        description: "Bucket with field-level ACL using typed fields",
        icon: "settings",
        primary: "name",
        readOnly: false,
        acl: {write: "true==true", read: "true==true"},
        properties: {
          name: {
            type: "string",
            title: "Name",
            acl: fieldAclExpression
          },
          password: {type: "hash", title: "Password"},
          secret: {type: "encrypted", title: "Secret"},
          created: {type: "date", title: "Created"}
        }
      });

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
