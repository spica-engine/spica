import {Test, TestingModule} from "@nestjs/testing";
import {EnvVarService} from "@spica-server/env_var/services";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {envVarSupplier, envVarApplier} from "../src/env_var.synchronizer";
import {
  ChangeLog,
  ChangeOrigin,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import YAML from "yaml";
import {EnvVar} from "@spica-server/interface/env_var";

describe("EnvVar Synchronizer", () => {
  let module: TestingModule;
  let evs: EnvVarService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [EnvVarService]
    }).compile();

    evs = module.get(EnvVarService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe("envVarSupplier", () => {
    let supplier;

    beforeEach(() => {
      supplier = envVarSupplier(evs);
    });

    it("should return ChangeSupplier with correct metadata", () => {
      expect(supplier).toMatchObject({
        module: "env-var",
        subModule: "schema",
        fileExtension: "yaml",
        listen: expect.any(Function)
      });
    });

    it("should emit ChangeLog on env_var insert", done => {
      const mockEnvVar: EnvVar = {
        _id: new ObjectId(),
        key: "TEST_API_KEY",
        value: "test-secret-value"
      };

      const observable = supplier.listen();

      observable.subscribe(changeLog => {
        expect(changeLog).toMatchObject({
          module: "env-var",
          sub_module: "schema",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: mockEnvVar._id.toString(),
          resource_slug: "TEST_API_KEY",
          resource_content: YAML.stringify(mockEnvVar),
          created_at: expect.any(Date)
        });

        done();
      });

      evs.insertOne(mockEnvVar).catch(done.fail);
    });

    it("should emit ChangeLog on env_var update", done => {
      const envVarId = new ObjectId();
      const initialEnvVar: EnvVar = {
        _id: envVarId,
        key: "DATABASE_URL",
        value: "mongodb://localhost:27017/old"
      };

      const updatedEnvVar: EnvVar = {
        _id: envVarId,
        key: "DATABASE_URL",
        value: "mongodb://localhost:27017/new"
      };

      const observable = supplier.listen();

      observable.subscribe(changeLog => {
        if (changeLog.type === ChangeType.UPDATE) {
          expect(changeLog).toMatchObject({
            module: "env-var",
            sub_module: "schema",
            type: ChangeType.UPDATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: envVarId.toString(),
            resource_slug: "DATABASE_URL",
            resource_content: YAML.stringify(updatedEnvVar),
            created_at: expect.any(Date)
          });
          done();
        }
      });

      evs
        .insertOne(initialEnvVar)
        .then(() => evs.replaceOne({_id: envVarId}, updatedEnvVar))
        .catch(done.fail);
    });

    it("should emit ChangeLog on env_var delete", done => {
      const envVarId = new ObjectId();
      const envVarToDelete: EnvVar = {
        _id: envVarId,
        key: "TEMP_SECRET",
        value: "will-be-deleted"
      };

      const observable = supplier.listen();

      observable.subscribe(changeLog => {
        if (changeLog.type === ChangeType.DELETE) {
          expect(changeLog).toMatchObject({
            module: "env-var",
            sub_module: "schema",
            type: ChangeType.DELETE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: envVarId.toString(),
            resource_slug: null,
            resource_content: "",
            created_at: expect.any(Date)
          });

          done();
        }
      });

      evs
        .insertOne(envVarToDelete)
        .then(() => evs.deleteOne({_id: envVarId}))
        .catch(done.fail);
    });
  });

  describe("envVarApplier", () => {
    let applier;

    beforeEach(() => {
      applier = envVarApplier(evs);
    });

    it("should return ChangeApplier with correct metadata", () => {
      expect(applier).toMatchObject({
        module: "env-var",
        subModule: "schema",
        fileExtension: "yaml",
        apply: expect.any(Function)
      });
    });

    it("should apply insert change successfully", async () => {
      const _id = new ObjectId();
      const mockEnvVar: EnvVar = {
        _id,
        key: "NEW_API_KEY",
        value: "new-secret-value"
      };

      const changeLog: ChangeLog = {
        module: "env-var",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: "NEW_API_KEY",
        resource_content: YAML.stringify(mockEnvVar),
        created_at: new Date()
      };

      const result = await applier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const insertedEnvVar = await evs.findOne({_id});
      expect(insertedEnvVar).toEqual({
        _id,
        key: "NEW_API_KEY",
        value: "new-secret-value"
      });
    });

    it("should apply update change successfully", async () => {
      const _id = new ObjectId();
      const existingEnvVar: EnvVar = {
        _id,
        key: "OLD_SECRET",
        value: "old-value"
      };

      await evs.insertOne(existingEnvVar);

      const updatedEnvVar: EnvVar = {
        _id,
        key: "OLD_SECRET",
        value: "updated-value"
      };

      const changeLog: ChangeLog = {
        module: "env-var",
        sub_module: "schema",
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: "OLD_SECRET",
        resource_content: YAML.stringify(updatedEnvVar),
        created_at: new Date()
      };

      const result = await applier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const envVar = await evs.findOne({_id});
      expect(envVar).toMatchObject({
        _id,
        key: "OLD_SECRET",
        value: "updated-value"
      });
    });

    it("should apply delete change successfully", async () => {
      const _id = new ObjectId();
      const mockEnvVar: EnvVar = {
        _id,
        key: "TO_DELETE",
        value: "will-be-removed"
      };

      await evs.insertOne(mockEnvVar);

      const changeLog: ChangeLog = {
        module: "env-var",
        sub_module: "schema",
        type: ChangeType.DELETE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: null,
        resource_content: "",
        created_at: new Date()
      };

      const result = await applier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const envVar = await evs.findOne({_id});
      expect(envVar).toBeNull();
    });

    it("should handle unknown operation type", async () => {
      const changeLog: ChangeLog = {
        module: "env-var",
        sub_module: "schema",
        type: "upsert" as any,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: null,
        resource_content: "",
        created_at: new Date()
      };

      const result = await applier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED,
        reason: "Unknown operation type: upsert"
      });
    });

    it("should handle YAML parse errors", async () => {
      const changeLog: ChangeLog = {
        module: "env-var",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: "TEST",
        resource_content: "invalid: yaml: content:",
        created_at: new Date()
      };

      const result = await applier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED
      });
      expect(result.reason).toBeDefined();
    });
  });
});
