import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {FunctionService} from "@spica-server/function-services";
import {EnvVarService, EnvVarChangeDispatcher} from "@spica-server/env_var-services";
import {SecretService, SecretChangeDispatcher} from "@spica-server/secret-services";
import * as CRUD from "@spica-server/function/src/crud";
import {Function} from "@spica-server/interface-function";

describe("Function CRUD relation normalization", () => {
  let module: TestingModule;
  let database: DatabaseService;
  let fs: FunctionService;
  let engine: any;

  const baseFn = () =>
    ({
      name: "test",
      language: "javascript",
      timeout: 10
    }) as Function;

  function rawFunction(id: ObjectId) {
    return database.collection("function").findOne({_id: id});
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();

    database = module.get(DatabaseService);

    const evs = new EnvVarService(database, new EnvVarChangeDispatcher());
    const ss = new SecretService(database, "test-encryption-secret", new SecretChangeDispatcher());
    fs = new FunctionService(database, evs, ss, {} as any);

    engine = {
      applyChangePlan: jest.fn().mockResolvedValue(undefined),
      storeAssets: jest.fn().mockResolvedValue(undefined)
    };
  });

  afterEach(async () => module.close());

  describe("insert", () => {
    it("should convert string relation ids to ObjectId", async () => {
      const secretId = new ObjectId().toHexString();
      const envVarId = new ObjectId().toHexString();

      const fn = await CRUD.insert(fs, engine, {
        ...baseFn(),
        secrets: [secretId],
        env_vars: [envVarId]
      } as any);

      const raw = await rawFunction(fn._id);

      expect(raw.secrets[0]).toBeInstanceOf(ObjectId);
      expect(raw.secrets[0].toHexString()).toEqual(secretId);
      expect(raw.env_vars[0]).toBeInstanceOf(ObjectId);
      expect(raw.env_vars[0].toHexString()).toEqual(envVarId);
    });

    it("should keep ObjectId relation ids untouched", async () => {
      const secretId = new ObjectId();

      const fn = await CRUD.insert(fs, engine, {
        ...baseFn(),
        secrets: [secretId]
      } as any);

      const raw = await rawFunction(fn._id);

      expect(raw.secrets).toHaveLength(1);
      expect(raw.secrets[0].toHexString()).toEqual(secretId.toHexString());
    });

    it("should deduplicate mixed string and ObjectId representations", async () => {
      const secretId = new ObjectId();

      const fn = await CRUD.insert(fs, engine, {
        ...baseFn(),
        secrets: [secretId.toHexString(), secretId]
      } as any);

      const raw = await rawFunction(fn._id);

      expect(raw.secrets).toHaveLength(1);
      expect(raw.secrets[0]).toBeInstanceOf(ObjectId);
    });

    it("should leave absent relation fields absent", async () => {
      const fn = await CRUD.insert(fs, engine, baseFn());

      const raw = await rawFunction(fn._id);

      expect(raw.secrets).toBeUndefined();
      expect(raw.env_vars).toBeUndefined();
    });

    it("should reject a malformed relation id", async () => {
      await expect(
        CRUD.insert(fs, engine, {...baseFn(), secrets: ["not-an-object-id"]} as any)
      ).rejects.toThrow("not-an-object-id is not a valid id.");
    });
  });

  describe("replace", () => {
    it("should convert string relation ids to ObjectId", async () => {
      const inserted = await CRUD.insert(fs, engine, baseFn());
      const secretId = new ObjectId().toHexString();

      await CRUD.replace(fs, engine, {
        ...baseFn(),
        _id: inserted._id,
        secrets: [secretId]
      } as any);

      const raw = await rawFunction(new ObjectId(inserted._id));

      expect(raw.secrets[0]).toBeInstanceOf(ObjectId);
      expect(raw.secrets[0].toHexString()).toEqual(secretId);
    });

    it("should not downgrade an existing ObjectId relation to a string", async () => {
      const secretId = new ObjectId();
      const inserted = await CRUD.insert(fs, engine, {
        ...baseFn(),
        secrets: [secretId]
      } as any);

      await CRUD.replace(fs, engine, {
        ...baseFn(),
        _id: inserted._id,
        name: "renamed",
        secrets: [secretId.toHexString()]
      } as any);

      const raw = await rawFunction(new ObjectId(inserted._id));

      expect(raw.name).toEqual("renamed");
      expect(raw.secrets).toHaveLength(1);
      expect(raw.secrets[0]).toBeInstanceOf(ObjectId);
    });
  });
});
