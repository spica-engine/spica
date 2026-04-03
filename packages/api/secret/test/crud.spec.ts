import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {SecretService, ServicesModule} from "@spica-server/secret-services";
import {isEncryptedData} from "@spica-server/core/encryption";
import * as CRUD from "../src/crud";
import {NotFoundException, INestApplication} from "@nestjs/common";

const ENCRYPTION_SECRET = "test-encryption-secret-32chars!!";

describe("Secret CRUD", () => {
  let ss: SecretService;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.standalone(),
        ServicesModule.forRoot({encryptionSecret: ENCRYPTION_SECRET})
      ]
    }).compile();

    ss = module.get(SecretService);
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  describe("insert", () => {
    it("should insert a secret and return it without value", async () => {
      const result = await CRUD.insert(ss, {key: "API_KEY", value: "my-secret-value"});

      expect(result._id).toBeDefined();
      expect(result.key).toBe("API_KEY");
      expect((result as any).value).toBeUndefined();
    });

    it("should store the value as encrypted in the database", async () => {
      const result = await CRUD.insert(ss, {key: "DB_PASS", value: "plaintext-password"});

      const raw = await ss.findOne({_id: result._id});

      expect(raw.value).toBeDefined();
      expect(raw.value).not.toBe("plaintext-password");
      expect(isEncryptedData(raw.value)).toBe(true);
      expect(raw.value.encrypted).toBeDefined();
      expect(raw.value.iv).toBeDefined();
      expect(raw.value.authTag).toBeDefined();
    });

    it("should accept a custom _id", async () => {
      const customId = new ObjectId();
      const result = await CRUD.insert(ss, {
        _id: customId,
        key: "CUSTOM_ID_KEY",
        value: "val"
      });

      expect(result._id.toHexString()).toBe(customId.toHexString());
      expect(result.key).toBe("CUSTOM_ID_KEY");
      expect((result as any).value).toBeUndefined();
    });
  });

  describe("findOne", () => {
    it("should return a secret by id with value hidden", async () => {
      const inserted = await CRUD.insert(ss, {key: "SECRET_KEY", value: "secret123"});

      const found = await CRUD.findOne(ss, inserted._id);

      expect(found._id).toEqual(inserted._id);
      expect(found.key).toBe("SECRET_KEY");
      expect((found as any).value).toBeUndefined();
    });

    it("should throw NotFoundException for non-existent id", async () => {
      const nonExistentId = new ObjectId();

      await expect(CRUD.findOne(ss, nonExistentId)).rejects.toThrow(NotFoundException);
    });
  });

  describe("find", () => {
    beforeEach(async () => {
      await CRUD.insert(ss, {key: "KEY_A", value: "val_a"});
      await CRUD.insert(ss, {key: "KEY_B", value: "val_b"});
      await CRUD.insert(ss, {key: "KEY_C", value: "val_c"});
    });

    it("should return all secrets with values hidden", async () => {
      const results = (await CRUD.find(ss, {
        limit: 0,
        skip: 0,
        paginate: false
      })) as any[];

      expect(results.length).toBe(3);
      results.forEach(s => {
        expect(s.key).toBeDefined();
        expect(s.value).toBeUndefined();
        expect(s._id).toBeDefined();
      });
    });

    it("should support limit and skip", async () => {
      const results = (await CRUD.find(ss, {
        limit: 1,
        skip: 1,
        sort: {key: 1},
        paginate: false
      })) as any[];

      expect(results.length).toBe(1);
      expect(results[0].key).toBe("KEY_B");
      expect(results[0].value).toBeUndefined();
    });

    it("should support pagination", async () => {
      const result = (await CRUD.find(ss, {
        limit: 0,
        skip: 0,
        sort: {_id: -1},
        paginate: true
      })) as any;

      expect(result.meta.total).toBe(3);
      expect(result.data.length).toBe(3);
      result.data.forEach(s => {
        expect(s.value).toBeUndefined();
      });
    });

    it("should filter by key", async () => {
      const results = (await CRUD.find(ss, {
        limit: 0,
        skip: 0,
        paginate: false,
        filter: {key: "KEY_B"}
      })) as any[];

      expect(results.length).toBe(1);
      expect(results[0].key).toBe("KEY_B");
    });
  });

  describe("replace", () => {
    it("should replace a secret and return it without value", async () => {
      const inserted = await CRUD.insert(ss, {key: "OLD_KEY", value: "old_val"});

      const replaced = await CRUD.replace(ss, inserted._id, {
        key: "NEW_KEY",
        value: "new_val"
      });

      expect(replaced._id).toEqual(inserted._id);
      expect(replaced.key).toBe("NEW_KEY");
      expect((replaced as any).value).toBeUndefined();
    });

    it("should store replaced value as encrypted in the database", async () => {
      const inserted = await CRUD.insert(ss, {key: "REPLACE_KEY", value: "old_value"});

      await CRUD.replace(ss, inserted._id, {key: "REPLACE_KEY", value: "updated_value"});

      const raw = await ss.findOne({_id: inserted._id});

      expect(raw.value).not.toBe("updated_value");
      expect(isEncryptedData(raw.value)).toBe(true);
    });

    it("should throw NotFoundException for non-existent id", async () => {
      const nonExistentId = new ObjectId();

      await expect(CRUD.replace(ss, nonExistentId, {key: "KEY", value: "val"})).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("remove", () => {
    it("should remove a secret", async () => {
      const inserted = await CRUD.insert(ss, {key: "TO_DELETE", value: "val"});

      await CRUD.remove(ss, inserted._id);

      const all = (await CRUD.find(ss, {
        limit: 0,
        skip: 0,
        paginate: false
      })) as any[];

      expect(all.length).toBe(0);
    });

    it("should throw NotFoundException for non-existent id", async () => {
      const nonExistentId = new ObjectId();

      await expect(CRUD.remove(ss, nonExistentId)).rejects.toThrow(NotFoundException);
    });
  });
});
