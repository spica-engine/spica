import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {SecretModule} from "../src";
import {PassportTestingModule} from "@spica-server/passport-testing";

const ENCRYPTION_SECRET = "test-encryption-secret-32chars!!";

describe("Secret", () => {
  let req: Request;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.standalone(),
        CoreTestingModule,
        SecretModule.forRoot({realtime: false, encryptionSecret: ENCRYPTION_SECRET}),
        SchemaModule.forRoot({formats: [OBJECT_ID]}),
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"})
      ]
    }).compile();

    req = module.get(Request);

    app = module.createNestApplication();

    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("find", () => {
    it("should return all secrets with values hidden", async () => {
      await req.post("/secret", {key: "SECRET_KEY", value: "my-secret-value"});

      const res = await req.get("/secret");
      expect(res.body.length).toBe(1);
      expect(res.body[0].key).toBe("SECRET_KEY");
      expect(res.body[0].value).toBeUndefined();
      expect(res.body[0]._id).toBeDefined();
    });

    it("should support limit, skip and sort", async () => {
      await req.post("/secret", {key: "KEY_A", value: "val_a"});
      await req.post("/secret", {key: "KEY_B", value: "val_b"});
      await req.post("/secret", {key: "KEY_C", value: "val_c"});

      const res = await req.get(`/secret`, {
        skip: 1,
        limit: 1,
        sort: JSON.stringify({key: 1})
      });
      expect(res.body.length).toBe(1);
      expect(res.body[0].key).toBe("KEY_B");
      expect(res.body[0].value).toBeUndefined();
    });

    it("should paginate", async () => {
      await req.post("/secret", {key: "KEY_1", value: "val_1"});
      await req.post("/secret", {key: "KEY_2", value: "val_2"});
      await req.post("/secret", {key: "KEY_3", value: "val_3"});

      const res = await req.get(`/secret`, {paginate: true, sort: JSON.stringify({_id: -1})});
      expect(res.body.meta.total).toBe(3);
      expect(res.body.data.length).toBe(3);
      res.body.data.forEach(s => {
        expect(s.value).toBeUndefined();
      });
    });

    it("should filter by key", async () => {
      await req.post("/secret", {key: "KEY_1", value: "val_1"});
      await req.post("/secret", {key: "KEY_2", value: "val_2"});

      const res = await req.get(`/secret`, {filter: JSON.stringify({key: "KEY_2"})});
      expect(res.body.length).toBe(1);
      expect(res.body[0].key).toBe("KEY_2");
    });
  });

  describe("findOne", () => {
    it("should return secret by id with value hidden", async () => {
      const {body: inserted} = await req.post("/secret", {key: "MY_SECRET", value: "secret123"});

      const res = await req.get(`/secret/${inserted._id}`);
      expect(res.body._id).toBe(inserted._id);
      expect(res.body.key).toBe("MY_SECRET");
      expect(res.body.value).toBeUndefined();
    });

    it("should return 404 for non-existent id", async () => {
      const res = await req.get(`/secret/${new ObjectId()}`).catch(r => r);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("insertOne", () => {
    it("should create a new secret and return it without value", async () => {
      const {body} = await req.post("/secret", {key: "API_KEY", value: "super-secret"});

      expect(body._id).toBeDefined();
      expect(body.key).toBe("API_KEY");
      expect(body.value).toBeUndefined();
    });

    it("should encrypt the value in the database", async () => {
      const {body} = await req.post("/secret", {key: "DB_PASS", value: "plaintext-password"});

      const found = await req.get(`/secret/${body._id}`);
      expect(found.body.value).toBeUndefined();
      expect(found.body.key).toBe("DB_PASS");
    });

    it("should return validation errors when value is missing", async () => {
      const res = await req.post("/secret", {key: "NO_VALUE"}).catch(r => r);

      expect(res.statusCode).toBe(400);
    });

    it("should return validation errors when key is missing", async () => {
      const res = await req.post("/secret", {value: "no_key"}).catch(r => r);

      expect(res.statusCode).toBe(400);
    });

    it("should reject duplicate keys", async () => {
      await req.post("/secret", {key: "UNIQUE_KEY", value: "val1"});

      const res = await req.post("/secret", {key: "UNIQUE_KEY", value: "val2"}).catch(r => r);

      expect(res.statusCode).toBe(500);
    });
  });

  describe("updateOne", () => {
    it("should update secret and return without value", async () => {
      const {body: inserted} = await req.post("/secret", {key: "OLD_KEY", value: "old_val"});

      const {body: updated} = await req.put(`/secret/${inserted._id}`, {
        key: "NEW_KEY",
        value: "new_val"
      });

      expect(updated._id).toBe(inserted._id);
      expect(updated.key).toBe("NEW_KEY");
      expect(updated.value).toBeUndefined();
    });

    it("should return 404 for non-existent secret", async () => {
      const res = await req
        .put(`/secret/${new ObjectId()}`, {key: "KEY", value: "val"})
        .catch(r => r);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("delete", () => {
    it("should delete secret", async () => {
      const {body} = await req.post("/secret", {key: "TO_DELETE", value: "val"});

      const res = await req.delete(`/secret/${body._id}`);
      expect([res.statusCode, res.statusText]).toEqual([204, "No Content"]);

      const {body: secrets} = await req.get("/secret");
      expect(secrets.length).toEqual(0);
    });

    it("should return 404 for non-existent secret", async () => {
      const res = await req.delete(`/secret/${new ObjectId()}`).catch(r => r);

      expect(res.statusCode).toBe(404);
    });
  });
});
