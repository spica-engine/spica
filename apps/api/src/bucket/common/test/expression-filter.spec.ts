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

describe("Expression Filter Type Construction", () => {
  let app: INestApplication;
  let req: Request;
  let database: DatabaseService;
  let module: TestingModule;

  const HASH_SECRET = "test-hash-secret-123";
  const ENCRYPTION_SECRET = "01234567890123456789012345678901";

  let dateBucketId: string;
  let hashBucketId: string;
  let encryptedBucketId: string;
  let mixedBucketId: string;

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
    database = module.get(DatabaseService);
    app.use(Middlewares.MergePatchJsonParser(10));
    await app.listen(req.socket);

    dateBucketId = new ObjectId().toHexString();
    hashBucketId = new ObjectId().toHexString();
    encryptedBucketId = new ObjectId().toHexString();
    mixedBucketId = new ObjectId().toHexString();

    const dateBucket = {
      _id: dateBucketId,
      title: "Date Bucket",
      description: "Bucket with date fields",
      icon: "calendar_today",
      primary: "title",
      readOnly: false,
      acl: {write: "true==true", read: "true==true"},
      properties: {
        title: {type: "string", title: "Title"},
        due_date: {type: "date", title: "Due Date"},
        priority: {type: "number", title: "Priority"}
      }
    };

    const hashBucket = {
      _id: hashBucketId,
      title: "Hash Bucket",
      description: "Bucket with hash fields",
      icon: "lock",
      primary: "username",
      readOnly: false,
      acl: {write: "true==true", read: "true==true"},
      properties: {
        username: {type: "string", title: "Username"},
        password: {type: "hash", title: "Password"},
        age: {type: "number", title: "Age"}
      }
    };

    const encryptedBucket = {
      _id: encryptedBucketId,
      title: "Encrypted Bucket",
      description: "Bucket with encrypted fields",
      icon: "lock",
      primary: "label",
      readOnly: false,
      acl: {write: "true==true", read: "true==true"},
      properties: {
        label: {type: "string", title: "Label"},
        secret_note: {type: "encrypted", title: "Secret Note"},
        age: {type: "number", title: "Age"}
      }
    };

    const mixedBucket = {
      _id: mixedBucketId,
      title: "Mixed Bucket",
      description: "Bucket with date, hash, and encrypted fields",
      icon: "lock",
      primary: "name",
      readOnly: false,
      acl: {write: "true==true", read: "true==true"},
      properties: {
        name: {type: "string", title: "Name"},
        password: {type: "hash", title: "Password"},
        secret: {type: "encrypted", title: "Secret"},
        created: {type: "date", title: "Created"}
      }
    };

    await Promise.all([
      req.post("/bucket", dateBucket),
      req.post("/bucket", hashBucket),
      req.post("/bucket", encryptedBucket),
      req.post("/bucket", mixedBucket)
    ]);
  });

  afterEach(() => app.close());

  describe("Date field expression filter", () => {
    const date1 = "2024-01-15T00:00:00.000Z";
    const date2 = "2024-06-20T00:00:00.000Z";
    const date3 = "2024-12-31T00:00:00.000Z";

    beforeEach(async () => {
      await Promise.all([
        req.post(`/bucket/${dateBucketId}/data`, {
          title: "task1",
          due_date: date1,
          priority: 1
        }),
        req.post(`/bucket/${dateBucketId}/data`, {
          title: "task2",
          due_date: date2,
          priority: 2
        }),
        req.post(`/bucket/${dateBucketId}/data`, {
          title: "task3",
          due_date: date3,
          priority: 3
        })
      ]);
    });

    it("should filter by date field using == operator", async () => {
      const response = await req.get(`/bucket/${dateBucketId}/data`, {
        filter: `document.due_date == "${date1}"`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe("task1");
    });

    it("should filter by date field using > operator", async () => {
      const response = await req.get(`/bucket/${dateBucketId}/data`, {
        filter: `document.due_date > "${date2}"`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe("task3");
    });

    it("should filter by date field using < operator", async () => {
      const response = await req.get(`/bucket/${dateBucketId}/data`, {
        filter: `document.due_date < "${date2}"`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe("task1");
    });

    it("should filter by date field using >= operator", async () => {
      const response = await req.get(`/bucket/${dateBucketId}/data`, {
        filter: `document.due_date >= "${date2}"`
      });

      expect(response.body.length).toBe(2);
      const titles = response.body.map(d => d.title).sort();
      expect(titles).toEqual(["task2", "task3"]);
    });

    it("should filter by date field using <= operator", async () => {
      const response = await req.get(`/bucket/${dateBucketId}/data`, {
        filter: `document.due_date <= "${date2}"`
      });

      expect(response.body.length).toBe(2);
      const titles = response.body.map(d => d.title).sort();
      expect(titles).toEqual(["task1", "task2"]);
    });

    it("should filter by date field using != operator", async () => {
      const response = await req.get(`/bucket/${dateBucketId}/data`, {
        filter: `document.due_date != "${date1}"`
      });

      expect(response.body.length).toBe(2);
      const titles = response.body.map(d => d.title).sort();
      expect(titles).toEqual(["task2", "task3"]);
    });

    it("should filter by date range using && operator", async () => {
      const response = await req.get(`/bucket/${dateBucketId}/data`, {
        filter: `document.due_date > "${date1}" && document.due_date < "${date3}"`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe("task2");
    });

    it("should combine date filter with non-date filter", async () => {
      const response = await req.get(`/bucket/${dateBucketId}/data`, {
        filter: `document.due_date >= "${date2}" && document.priority > 2`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe("task3");
    });
  });

  describe("Hash field expression filter", () => {
    beforeEach(async () => {
      await Promise.all([
        req.post(`/bucket/${hashBucketId}/data`, {
          username: "alice",
          password: "alicepass",
          age: 28
        }),
        req.post(`/bucket/${hashBucketId}/data`, {
          username: "bob",
          password: "bobpass",
          age: 32
        }),
        req.post(`/bucket/${hashBucketId}/data`, {
          username: "charlie",
          password: "charliepass",
          age: 45
        })
      ]);
    });

    it("should filter by hash field using == operator", async () => {
      const response = await req.get(`/bucket/${hashBucketId}/data`, {
        filter: `document.password == "bobpass"`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].username).toBe("bob");
    });

    it("should return empty when hash field filter does not match", async () => {
      const response = await req.get(`/bucket/${hashBucketId}/data`, {
        filter: `document.password == "wrongpassword"`
      });

      expect(response.body.length).toBe(0);
    });

    it("should combine hash field filter with other filters using &&", async () => {
      // to prove second filter works
      await req.post(`/bucket/${hashBucketId}/data`, {
        username: "bob",
        password: "bobpass",
        age: 33
      });

      const response = await req.get(`/bucket/${hashBucketId}/data`, {
        filter: `document.password == "bobpass" && document.age == 33`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].username).toBe("bob");
      expect(response.body[0].age).toBe(33);
    });
  });

  describe("Encrypted field expression filter", () => {
    beforeEach(async () => {
      await Promise.all([
        req.post(`/bucket/${encryptedBucketId}/data`, {
          label: "alice",
          secret_note: "alice-secret",
          age: 28
        }),
        req.post(`/bucket/${encryptedBucketId}/data`, {
          label: "bob",
          secret_note: "bob-secret",
          age: 32
        })
      ]);
    });

    it("should filter by encrypted field using == operator", async () => {
      const response = await req.get(`/bucket/${encryptedBucketId}/data`, {
        filter: `document.secret_note == "alice-secret"`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].label).toBe("alice");
      expect(response.body[0].secret_note).toBe("alice-secret");
    });

    it("should return empty when encrypted field filter does not match", async () => {
      const response = await req.get(`/bucket/${encryptedBucketId}/data`, {
        filter: `document.secret_note == "nonexistent"`
      });

      expect(response.body.length).toBe(0);
    });

    it("should combine encrypted field filter with other filters", async () => {
      // proves label filter works
      await req.post(`/bucket/${encryptedBucketId}/data`, {
        label: "bob2",
        secret_note: "bob-secret",
        age: 32
      });
      const response = await req.get(`/bucket/${encryptedBucketId}/data`, {
        filter: `document.secret_note == "bob-secret" && document.label == "bob2"`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].label).toBe("bob2");
      expect(response.body[0].secret_note).toBe("bob-secret");
      expect(response.body[0].age).toBe(32);
    });
  });

  describe("Mixed field types expression filter", () => {
    const createdDate = "2024-03-15T10:00:00.000Z";

    beforeEach(async () => {
      await Promise.all([
        req.post(`/bucket/${mixedBucketId}/data`, {
          name: "user1",
          password: "pass1",
          secret: "secret1",
          created: createdDate
        }),
        req.post(`/bucket/${mixedBucketId}/data`, {
          name: "user2",
          password: "pass2",
          secret: "secret2",
          created: "2024-06-01T10:00:00.000Z"
        })
      ]);
    });

    it("should filter by hash and date fields together", async () => {
      const response = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.password == "pass1" && document.created == "${createdDate}"`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe("user1");
    });

    it("should filter by encrypted and date fields together", async () => {
      const response = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.secret == "secret1" && document.created == "${createdDate}"`
      });

      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe("user1");
    });

    it("should filter using || with different field types", async () => {
      const response = await req.get(`/bucket/${mixedBucketId}/data`, {
        filter: `document.password == "pass1" || document.name == "user2"`
      });

      expect(response.body.length).toBe(2);
      const names = response.body.map(d => d.name).sort();
      expect(names).toEqual(["user1", "user2"]);
    });
  });
});
