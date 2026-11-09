import {contractSuite} from "@spica-server/database-testing";
import {Request} from "@spica-server/core-testing";
import {BucketApp, startBucketApp} from "../../test/support/bucket-app";

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
contractSuite("Expression Filter Type Construction", engine => {
  let api: BucketApp;
  let req: Request;
  let key: "_id" | "id";

  const HASH_SECRET = "test-hash-secret-123";
  const ENCRYPTION_SECRET = "01234567890123456789012345678901";

  let eventBucketId: string;
  let mixedBucketId: string;

  let aliceId: string;
  let bobId: string;

  beforeEach(async () => {
    api = await startBucketApp(engine, {
      hashSecret: HASH_SECRET,
      encryptionSecret: ENCRYPTION_SECRET
    });
    req = api.req;
    key = api.keyField;

    eventBucketId = (
      await api.createBucket(
        {
          label: {type: "string", title: "Label"},
          event_date: {type: "date", title: "Event Date"}
        },
        {
          title: "Event Bucket",
          description: "Bucket holding event records with a date field",
          icon: "event",
          acl: {write: "true==true", read: "true==true"}
        }
      )
    )._id;

    mixedBucketId = (
      await api.createBucket(
        {
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
        },
        {
          title: "Mixed Bucket",
          description: "Bucket with hash, encrypted, date, nested object, and relation fields",
          icon: "settings",
          acl: {write: "true==true", read: "true==true"}
        }
      )
    )._id;
  });

  afterEach(() => api.close());

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
        event: eventAliceRes.body[key]
      }),
      req.post(`/bucket/${mixedBucketId}/data`, {
        name: "bob",
        password: "pass_bob",
        secret: "sec_bob",
        created: BOB_DATE,
        credentials: {pin: "2222"},
        event: eventBobRes.body[key]
      })
    ]);

    aliceId = aliceRes.body[key];
    bobId = bobRes.body[key];
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
