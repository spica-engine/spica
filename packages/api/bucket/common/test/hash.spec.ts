import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../../test/support/bucket-app";
import {idOf} from "@spica-server/data";

contractSuite("Hash Field", engine => {
  const HASH_SECRET = "test-hash-secret-123";
  let api: BucketApp;
  let bucketId: string;
  let bucketId2: string;
  let key: "_id" | "id";

  beforeEach(async () => {
    api = await startBucketApp(engine, {hashSecret: HASH_SECRET});
    key = api.keyField;

    bucketId = idOf(
      await api.createBucket(
        {
          username: {type: "string", title: "Username"},
          password: {type: "hash", title: "Password"},
          age: {type: "number", title: "Age"}
        },
        {title: "User Bucket", description: "Bucket with hash password field", icon: "person"}
      )
    );

    bucketId2 = idOf(
      await api.createBucket(
        {
          username: {type: "string", title: "Username"},
          email: {type: "string", title: "Email"},
          user: {
            type: "object",
            title: "User",
            properties: {
              name: {type: "string", title: "Name"},
              surname: {type: "string", title: "Surname"},
              password: {type: "hash", title: "Password"},
              age: {type: "number", title: "Age"}
            }
          }
        },
        {
          title: "User Bucket2",
          description: "Bucket with nested hash password field",
          icon: "person"
        }
      )
    );
  });

  afterEach(() => api.close());

  const stored = async (id: string) => (await api.req.get(`/bucket/${bucketId}/data/${id}`)).body;

  describe("Write Operations - Field value will be stored as hash", () => {
    it("should hash password on insert", async () => {
      const response = await api.req.post(`/bucket/${bucketId}/data`, {
        username: "john_doe",
        password: "mysecretpassword",
        age: 30
      });

      expect(await stored(response.body[key])).toMatchObject({
        username: "john_doe",
        password: "1787bc90cb1d226e67065da0ae7ce8af44c7ed7b689c951ae00f590f9a6d794a",
        age: 30
      });
    });

    it("should hash password on replace", async () => {
      const insertResponse = await api.req.post(`/bucket/${bucketId}/data`, {
        username: "jane_doe",
        password: "oldpassword",
        age: 25
      });
      const documentId = insertResponse.body[key];

      await api.req.put(`/bucket/${bucketId}/data/${documentId}`, {
        username: "jane_updated",
        password: "newpassword",
        age: 26
      });

      expect(await stored(documentId)).toMatchObject({
        username: "jane_updated",
        password: "ccdc74486930c5a0bfef0f296a7ccd9720606b4d50dbee3116e47bef65316ea2",
        age: 26
      });
    });

    it("should hash password on patch", async () => {
      const insertResponse = await api.req.post(`/bucket/${bucketId}/data`, {
        username: "bob_smith",
        password: "initialpassword",
        age: 35
      });
      const documentId = insertResponse.body[key];

      await api.req.patch(`/bucket/${bucketId}/data/${documentId}`, {
        password: "patchedpassword"
      });

      expect(await stored(documentId)).toMatchObject({
        username: "bob_smith",
        password: "7607df5f375b3c5da191f6d052aa7d1f43ea28c6f8d5e5460898f0f7eaf854c9",
        age: 35
      });
    });
  });

  describe("Read Operations - Find request returns hash data", () => {
    beforeEach(async () => {
      await api.req.post(`/bucket/${bucketId}/data`, {
        username: "user1",
        password: "password123",
        age: 25
      });

      await api.req.post(`/bucket/${bucketId}/data`, {
        username: "user2",
        password: "password456",
        age: 30
      });
    });

    it("should return documents with hash passwords", async () => {
      const docs = (await api.req.get(`/bucket/${bucketId}/data`, {})).body;

      expect(docs.find(d => d.username === "user1")).toMatchObject({
        username: "user1",
        password: "142fec0c8e7a398e198660cf228c7158039dd839c913dc37bcc53e1e3cdafed7",
        age: 25
      });
      expect(docs.find(d => d.username === "user2")).toMatchObject({
        username: "user2",
        password: "f9414d8b2d69d0341a72d3e8a1d1f5cd17e0bde5697603e362e12a0f80d2859a",
        age: 30
      });
    });
  });

  describe("Filter Operations - Filter should work with hash fields", () => {
    beforeEach(async () => {
      for (const document of [
        {username: "alice", password: "alicepass", age: 28},
        {username: "bob", password: "bobpass", age: 32},
        {username: "charlie", password: "charliepass", age: 45}
      ]) {
        await api.req.post(`/bucket/${bucketId}/data`, document);
      }
    });

    const find = (filter: string) => api.req.get(`/bucket/${bucketId}/data`, {filter});

    it("should filter by hash field using plain text value", async () => {
      const response = await find(
        api.filter({password: "bobpass"}, 'document.password == "bobpass"')
      );

      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        username: "bob",
        password: "a21a300c2bf7a71d840c9aff3e0b9f3c38e7fb7f6a299a96f434178087616bb8",
        age: 32
      });
    });

    it("should filter with $in operator on hash field", async () => {
      const response = await find(
        api.filter(
          {password: {$in: ["alicepass", "charliepass"]}},
          'document.password in ["alicepass", "charliepass"]'
        )
      );

      expect(response.body.length).toBe(2);
      expect(response.body.map(doc => doc.username).sort()).toEqual(["alice", "charlie"]);
    });

    it("should filter with $eq operator on hash field", async () => {
      const response = await find(
        api.filter({password: {$eq: "alicepass"}}, 'document.password == "alicepass"')
      );

      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        username: "alice",
        password: "f36835b0ac86db4982ae60b3bf5f8bd3eff02c83cb4324f8140184222867f42d",
        age: 28
      });
    });

    it("should combine hash field filter with non-hash field filter", async () => {
      const response = await find(
        api.filter(
          {password: "bobpass", age: {$gte: 30}},
          'document.password == "bobpass" && document.age >= 30'
        )
      );

      expect(response.body.length).toBe(1);
      expect(response.body[0]).toMatchObject({
        username: "bob",
        password: "a21a300c2bf7a71d840c9aff3e0b9f3c38e7fb7f6a299a96f434178087616bb8",
        age: 32
      });
    });

    it("should return empty array when filter does not match", async () => {
      const response = await find(
        api.filter({password: "wrongpassword"}, 'document.password == "wrongpassword"')
      );

      expect(response.body.length).toBe(0);
    });
  });

  describe("should hash nested fields", () => {
    beforeEach(async () => {
      await api.req.post(`/bucket/${bucketId2}/data`, {
        username: "alice123",
        email: "alice@example.com",
        user: {name: "Alice", surname: "Wonderland", password: "alicepass", age: 28}
      });
    });

    it("should hash nested object field", async () => {
      const response = await api.req.get(`/bucket/${bucketId2}/data`, {
        filter: api.filter({"user.password": "alicepass"}, 'document.user.password == "alicepass"')
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
