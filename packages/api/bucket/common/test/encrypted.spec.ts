import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../../test/support/bucket-app";
import {corruptEncrypted, corruptEncryptedItem} from "../../test/support/corrupt";
import {idOf} from "@spica-server/data";

contractSuite("Encrypted Field", engine => {
  const ENCRYPTION_SECRET = "01234567890123456789012345678901";
  const HASH_SECRET = "test-hash-secret-123";

  let api: BucketApp;
  let key: string;
  let bucketId: string;
  let nestedBucketId: string;
  let mixedBucketId: string;

  beforeEach(async () => {
    api = await startBucketApp(engine, {
      hashSecret: HASH_SECRET,
      encryptionSecret: ENCRYPTION_SECRET
    });
    key = api.keyField;

    bucketId = idOf(
      await api.createBucket(
        {
          label: {type: "string", title: "Label"},
          secret_note: {type: "encrypted", title: "Secret Note"},
          age: {type: "number", title: "Age"}
        },
        {title: "Secure Bucket", description: "Bucket with encrypted field", icon: "lock"}
      )
    );

    nestedBucketId = idOf(
      await api.createBucket(
        {
          label: {type: "string", title: "Label"},
          credentials: {
            type: "object",
            title: "Credentials",
            properties: {
              username: {type: "string", title: "Username"},
              api_key: {type: "encrypted", title: "API Key"}
            }
          }
        },
        {
          title: "Nested Encrypted Bucket",
          description: "Bucket with nested encrypted field",
          icon: "lock"
        }
      )
    );

    mixedBucketId = idOf(
      await api.createBucket(
        {
          name: {type: "string", title: "Name"},
          password: {type: "hash", title: "Password"},
          ssn: {type: "encrypted", title: "SSN"}
        },
        {
          title: "Mixed Bucket",
          description: "Bucket with both hash and encrypted fields",
          icon: "lock"
        }
      )
    );
  });

  afterEach(() => api.close());

  const expectEncrypted = (value: any, withHash = true) => {
    expect(typeof value).toBe("object");
    expect(value.encrypted).toBeDefined();
    expect(value.iv).toBeDefined();
    expect(value.authTag).toBeDefined();
    if (withHash) {
      expect(typeof value.hash).toBe("string");
      expect(value.hash).toHaveLength(64);
    }
  };

  describe("Write Operations - Field value is stored as encrypted object in DB", () => {
    it("should store encrypted object on insert", async () => {
      const response = await api.req.post(`/bucket/${bucketId}/data`, {
        label: "doc1",
        secret_note: "my-secret-value",
        age: 30
      });
      const insertedDoc = response.body;

      expect(insertedDoc.label).toBe("doc1");
      expect(insertedDoc.age).toBe(30);
      expect(insertedDoc.secret_note).toBe("my-secret-value");

      const stored = await api.stored(bucketId, insertedDoc[key]);
      expect(stored.label).toBe("doc1");
      expect(stored.age).toBe(30);
      expectEncrypted(stored.secret_note);
      expect(stored.secret_note.encrypted).not.toBe("my-secret-value");
    });

    it("should store encrypted object on replace", async () => {
      const insertResponse = await api.req.post(`/bucket/${bucketId}/data`, {
        label: "doc-replace",
        secret_note: "old-secret",
        age: 25
      });
      const documentId = insertResponse.body[key];

      const replaceResponse = await api.req.put(`/bucket/${bucketId}/data/${documentId}`, {
        label: "doc-replace",
        secret_note: "new-secret",
        age: 26
      });

      expect(replaceResponse.body.label).toBe("doc-replace");
      expect(replaceResponse.body.age).toBe(26);
      expect(replaceResponse.body.secret_note).toBe("new-secret");
      expectEncrypted((await api.stored(bucketId, documentId)).secret_note, false);
    });

    it("should store encrypted object on patch", async () => {
      const insertResponse = await api.req.post(`/bucket/${bucketId}/data`, {
        label: "doc-patch",
        secret_note: "initial-secret",
        age: 35
      });
      const documentId = insertResponse.body[key];

      await api.req.patch(`/bucket/${bucketId}/data/${documentId}`, {
        secret_note: "patched-secret"
      });

      expectEncrypted((await api.stored(bucketId, documentId)).secret_note, false);
      expect((await api.req.get(`/bucket/${bucketId}/data/${documentId}`)).body.secret_note).toBe(
        "patched-secret"
      );
    });

    it("should store nested encrypted field as encrypted object", async () => {
      const response = await api.req.post(`/bucket/${nestedBucketId}/data`, {
        label: "nested-doc",
        credentials: {username: "admin", api_key: "sk-live-abc123"}
      });
      const insertedDoc = response.body;

      expect(insertedDoc.label).toBe("nested-doc");
      expect(insertedDoc.credentials.username).toBe("admin");
      expect(insertedDoc.credentials.api_key).toBe("sk-live-abc123");

      const stored = await api.stored(nestedBucketId, insertedDoc[key]);
      expect(stored.credentials.username).toBe("admin");
      expectEncrypted(stored.credentials.api_key, false);
    });
  });

  describe("Read Operations - API returns decrypted plaintext", () => {
    beforeEach(async () => {
      await api.req.post(`/bucket/${bucketId}/data`, {
        label: "user1",
        secret_note: "secret-alpha",
        age: 25
      });
      await api.req.post(`/bucket/${bucketId}/data`, {
        label: "user2",
        secret_note: "secret-beta",
        age: 30
      });
    });

    it("should return decrypted values on find", async () => {
      const docs = (await api.req.get(`/bucket/${bucketId}/data`, {})).body;

      expect(docs.find(d => d.label === "user1").secret_note).toBe("secret-alpha");
      expect(docs.find(d => d.label === "user2").secret_note).toBe("secret-beta");
    });

    it("should return decrypted value on findOne", async () => {
      const insertResponse = await api.req.post(`/bucket/${bucketId}/data`, {
        label: "single",
        secret_note: "single-secret",
        age: 40
      });

      const response = await api.req.get(
        `/bucket/${bucketId}/data/${insertResponse.body[key]}`,
        {}
      );

      expect(response.body.label).toBe("single");
      expect(response.body.secret_note).toBe("single-secret");
    });

    it("should return decrypted nested encrypted fields", async () => {
      const insertResponse = await api.req.post(`/bucket/${nestedBucketId}/data`, {
        label: "nested-read",
        credentials: {username: "admin", api_key: "sk-live-xyz789"}
      });

      const response = await api.req.get(
        `/bucket/${nestedBucketId}/data/${insertResponse.body[key]}`,
        {}
      );

      expect(response.body.credentials.username).toBe("admin");
      expect(response.body.credentials.api_key).toBe("sk-live-xyz789");
    });
  });

  describe("Filter Operations - Encrypted field filters match via deterministic hash", () => {
    beforeEach(async () => {
      await api.req.post(`/bucket/${bucketId}/data`, {
        label: "alice",
        secret_note: "alice-secret",
        age: 28
      });
      await api.req.post(`/bucket/${bucketId}/data`, {
        label: "bob",
        secret_note: "bob-secret",
        age: 32
      });
    });

    const find = (filter: string) => api.req.get(`/bucket/${bucketId}/data`, {filter});

    it("should filter on encrypted field and return matching document", async () => {
      const response = await find(
        api.filter({secret_note: "alice-secret"}, 'document.secret_note == "alice-secret"')
      );

      expect(response.body.length).toBe(1);
      expect(response.body[0].label).toBe("alice");
      expect(response.body[0].secret_note).toBe("alice-secret");
    });

    it("should keep non-encrypted filters alongside encrypted ones", async () => {
      const response = await find(
        api.filter(
          {secret_note: "alice-secret", age: 28},
          'document.secret_note == "alice-secret" && document.age == 28'
        )
      );

      expect(response.body.length).toBe(1);
      expect(response.body[0].label).toBe("alice");
    });

    it("should return no results when encrypted field filter does not match", async () => {
      const response = await find(
        api.filter(
          {secret_note: "nonexistent-secret"},
          'document.secret_note == "nonexistent-secret"'
        )
      );

      expect(response.body.length).toBe(0);
    });

    it("should filter encrypted field with $in operator", async () => {
      const response = await find(
        api.filter(
          {secret_note: {$in: ["alice-secret", "nonexistent"]}},
          'document.secret_note in ["alice-secret", "nonexistent"]'
        )
      );

      expect(response.body.length).toBe(1);
      expect(response.body[0].label).toBe("alice");
      expect(response.body[0].secret_note).toBe("alice-secret");
    });

    it("should handle $or with encrypted field filters", async () => {
      const response = await find(
        api.filter(
          {$or: [{secret_note: "alice-secret"}, {age: 32}]},
          'document.secret_note == "alice-secret" || document.age == 32'
        )
      );

      expect(response.body.length).toBe(2);
    });
  });

  describe("Mixed hash and encrypted fields", () => {
    it("should handle both hash and encrypted fields correctly", async () => {
      const response = await api.req.post(`/bucket/${mixedBucketId}/data`, {
        name: "Jane",
        password: "my-password",
        ssn: "123-45-6789"
      });
      const docId = response.body[key];

      const stored = await api.stored(mixedBucketId, docId);
      expect(typeof stored.password).toBe("string");
      expect(stored.password).not.toBe("my-password");
      expectEncrypted(stored.ssn);

      const readResponse = await api.req.get(`/bucket/${mixedBucketId}/data/${docId}`, {});
      expect(typeof readResponse.body.password).toBe("string");
      expect(readResponse.body.password).not.toBe("my-password");
      expect(readResponse.body.ssn).toBe("123-45-6789");
    });
  });

  describe("Error Handling", () => {
    it("should throw descriptive error when encrypted data is corrupted", async () => {
      const insertResponse = await api.req.post(`/bucket/${bucketId}/data`, {
        label: "test-corruption",
        secret_note: "original-secret",
        age: 40
      });
      const docId = insertResponse.body[key];

      await corruptEncrypted(api, bucketId, docId, ["secret_note"]);

      const response = await api.req.get(`/bucket/${bucketId}/data/${docId}`, {}).catch(e => e);
      expect(response.statusCode).toBe(500);
      expect(response.body.message).toContain("Decryption failed for document");
      expect(response.body.message).toContain(docId);
    });

    it("should handle decryption failure in nested encrypted fields", async () => {
      const insertResponse = await api.req.post(`/bucket/${nestedBucketId}/data`, {
        label: "nested-corruption",
        credentials: {username: "admin", api_key: "sk-live-original"}
      });
      const docId = insertResponse.body[key];

      await corruptEncrypted(api, nestedBucketId, docId, ["credentials", "api_key"]);

      const response = await api.req
        .get(`/bucket/${nestedBucketId}/data/${docId}`, {})
        .catch(e => e);
      expect(response.statusCode).toBe(500);
      expect(response.body.message).toContain("Decryption failed for document");
      expect(response.body.message).toContain(docId);
    });

    it("should handle decryption failure in array of encrypted fields", async () => {
      const arrayBucketId = idOf(
        await api.createBucket(
          {
            name: {type: "string", title: "Name"},
            secrets: {type: "array", title: "Secrets", items: {type: "encrypted"}}
          },
          {
            title: "Array Encrypted Bucket",
            description: "Bucket with array of encrypted fields",
            icon: "lock"
          }
        )
      );
      const insertResponse = await api.req.post(`/bucket/${arrayBucketId}/data`, {
        name: "array-test",
        secrets: ["secret1", "secret2", "secret3"]
      });
      const docId = insertResponse.body[key];

      await corruptEncryptedItem(api, arrayBucketId, docId, "secrets", 1);

      const response = await api.req
        .get(`/bucket/${arrayBucketId}/data/${docId}`, {})
        .catch(e => e);
      expect(response.statusCode).toBe(500);
      expect(response.body.message).toContain("Decryption failed for document");
      expect(response.body.message).toContain(docId);
    });
  });
});
