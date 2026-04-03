import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {OBJECTID_STRING, OBJECT_ID, DATE_TIME} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";

/**
 * Mixed bucket schema:
 *   name       : string
 *   password   : hash
 *   secret     : encrypted
 *   created    : date
 *   credentials: object { pin: hash }
 *   event      : relation (onetoone) → Event bucket
 *
 * Event bucket schema:
 *   label      : string
 *   event_date : date
 */
describe("Expression Filter Type Construction", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;

  const HASH_SECRET = "test-hash-secret-123";
  const ENCRYPTION_SECRET = "01234567890123456789012345678901";

  let eventBucketId: string;
  let mixedBucketId: string;

  // document IDs set per-suite in beforeEach
  let aliceId: string;
  let bobId: string;

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

    eventBucketId = new ObjectId().toHexString();
    mixedBucketId = new ObjectId().toHexString();

    await Promise.all([
      req.post("/bucket", {
        _id: eventBucketId,
        title: "Event Bucket",
        description: "Bucket holding event records with a date field",
        icon: "event",
        primary: "label",
        readOnly: false,
        acl: {write: "true==true", read: "true==true"},
        properties: {
          label: {type: "string", title: "Label"},
          event_date: {type: "date", title: "Event Date"}
        }
      }),
      req.post("/bucket", {
        _id: mixedBucketId,
        title: "Mixed Bucket",
        description: "Bucket with hash, encrypted, date, nested object, and relation fields",
        icon: "settings",
        primary: "name",
        readOnly: false,
        acl: {write: "true==true", read: "true==true"},
        properties: {
          name: {type: "string", title: "Name"},
          password: {type: "hash", title: "Password"},
          secret: {type: "encrypted", title: "Secret"},
          created: {type: "date", title: "Created"},
          credentials: {
            type: "object",
            title: "Credentials",
            properties: {
              pin: {type: "hash", title: "Pin"}
            }
          },
          event: {
            type: "relation",
            title: "Event",
            bucketId: eventBucketId,
            relationType: "onetoone"
          }
        }
      })
    ]);
  });

  afterEach(() => app.close());

  // ---------------------------------------------------------------------------
  // Shared data fixture — two event docs and two mixed docs (alice, bob)
  // ---------------------------------------------------------------------------
  const ALICE_DATE = "2024-02-15T00:00:00.000Z";
  const BOB_DATE = "2024-09-10T00:00:00.000Z";
  const EARLY_EVENT_DATE = "2024-01-01T00:00:00.000Z";
  const LATE_EVENT_DATE = "2024-08-01T00:00:00.000Z";

  async function seedData() {
    const [eventAliceRes, eventBobRes] = await Promise.all([
      req.post(`/bucket/${eventBucketId}/data`, {
        label: "early-event",
        event_date: EARLY_EVENT_DATE
      }),
      req.post(`/bucket/${eventBucketId}/data`, {label: "late-event", event_date: LATE_EVENT_DATE})
    ]);

    const [aliceRes, bobRes] = await Promise.all([
      req.post(`/bucket/${mixedBucketId}/data`, {
        name: "alice",
        password: "pass_alice",
        secret: "sec_alice",
        created: ALICE_DATE,
        credentials: {pin: "1111"},
        event: eventAliceRes.body._id
      }),
      req.post(`/bucket/${mixedBucketId}/data`, {
        name: "bob",
        password: "pass_bob",
        secret: "sec_bob",
        created: BOB_DATE,
        credentials: {pin: "2222"},
        event: eventBobRes.body._id
      })
    ]);

    aliceId = aliceRes.body._id;
    bobId = bobRes.body._id;
  }

  // ---------------------------------------------------------------------------
  // Individual field filters
  // ---------------------------------------------------------------------------
  describe("individual field filters", () => {
    beforeEach(seedData);

    it("should filter by date field", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.created == "${ALICE_DATE}"`
      });
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe("alice");
    });

    it("should filter by hash field", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.password == "pass_alice"`
      });
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe("alice");
    });

    it("should filter by encrypted field", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.secret == "sec_alice"`
      });
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe("alice");
      // encrypted value is returned decrypted by the API
      expect(res.body[0].secret).toBe("sec_alice");
    });

    it("should filter by nested object hash field", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.credentials.pin == "1111"`
      });
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe("alice");
    });

    it("should filter by relational date field", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.event.event_date == "${EARLY_EVENT_DATE}"`
      });
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe("alice");
    });
  });

  // ---------------------------------------------------------------------------
  // Combined filters (several important combinations)
  // ---------------------------------------------------------------------------
  describe("combined field filters", () => {
    beforeEach(seedData);

    it("should filter by date AND hash — only matching document returned", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.created == "${ALICE_DATE}" && document.password == "pass_alice"`
      });
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe("alice");
    });

    it("should filter by encrypted AND date — only matching document returned", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.secret == "sec_bob" && document.created == "${BOB_DATE}"`
      });
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe("bob");
    });

    it("should filter by nested hash AND relational date — only matching document returned", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.credentials.pin == "2222" && document.event.event_date == "${LATE_EVENT_DATE}"`
      });
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe("bob");
    });
  });

  // ---------------------------------------------------------------------------
  // Wrong-value filters (should return empty)
  // ---------------------------------------------------------------------------
  describe("wrong value filters", () => {
    beforeEach(seedData);

    it("should return empty for wrong date value", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.created == "2020-01-01T00:00:00.000Z"`
      });
      expect(res.body.length).toBe(0);
    });

    it("should return empty for wrong hash value", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.password == "wrong_password"`
      });
      expect(res.body.length).toBe(0);
    });

    it("should return empty for wrong encrypted value", async () => {
      const res = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.secret == "wrong_secret"`
      });
      expect(res.body.length).toBe(0);
    });
  });
});
