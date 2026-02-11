import {Test, TestingModule} from "@nestjs/testing";
import {SyncEngine} from "../../sync/engine/src/engine";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {
  ChangeInitiator,
  ChangeOrigin,
  ChangeType,
  SyncStatuses,
  VC_REPRESENTATIVE_MANAGER
} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  getApplier as getEnvVarApplier,
  getSupplier as getEnvVarSupplier
} from "@spica-server/env_var/src/synchronizer/schema";
import {EnvVarService} from "@spica-server/env_var/services";
import {EnvVar} from "@spica-server/interface/env_var";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {VersionControlModule} from "../../src";
import {SyncProcessor} from "../../processors/sync";
import YAML from "yaml";
import fs from "fs";

xdescribe("SyncEngine Integration - EnvVar", () => {
  let module: TestingModule;
  let syncEngine: SyncEngine;
  let syncProcessor: SyncProcessor;
  let repManager: VCRepresentativeManager;

  let envVarService: EnvVarService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        VersionControlModule.forRoot({
          isReplicationEnabled: false,
          persistentPath: join(tmpdir()),
          realtime: false
        }),
        PreferenceTestingModule
      ],
      providers: [EnvVarService]
    }).compile();

    syncEngine = module.get(SyncEngine);
    syncProcessor = module.get(SyncProcessor);
    repManager = module.get(VC_REPRESENTATIVE_MANAGER);

    envVarService = module.get(EnvVarService);

    syncEngine.registerChangeHandler(
      getEnvVarSupplier(envVarService),
      getEnvVarApplier(envVarService)
    );
  });

  afterEach(async () => {
    await module.close();
    const envVarDir = join(tmpdir(), "env-var");
    if (fs.existsSync(envVarDir)) {
      await fs.promises.rm(envVarDir, {recursive: true, force: true});
    }
  });

  it("should push sync to processor, but don't process until not approved", done => {
    const _id = new ObjectId();
    const key = "TEST_API_KEY";

    const testEnvVar: EnvVar = {
      _id,
      key,
      value: "secret_value_123"
    };

    const subs = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      expect(new Date(sync.created_at)).toBeInstanceOf(Date);
      expect(sync.created_at).toEqual(sync.updated_at);
      expect(sync.status).toBe(SyncStatuses.PENDING);
      expect(sync.change_log).toEqual({
        _id: sync.change_log._id,
        module: "env-var",
        sub_module: "schema",
        origin: ChangeOrigin.DOCUMENT,
        type: ChangeType.CREATE,
        resource_id: _id.toHexString(),
        resource_slug: key,
        resource_content: YAML.stringify(testEnvVar),
        resource_extension: "yaml",
        created_at: sync.change_log.created_at,
        initiator: ChangeInitiator.EXTERNAL
      });
      subs.unsubscribe();
      done();
    });

    envVarService.insertOne(testEnvVar);
  });

  it("should sync changes from document to representatives", done => {
    const _id = new ObjectId();
    const key = "TEST_API_KEY_DOC_TO_REP";

    const testEnvVar: EnvVar = {
      _id,
      key,
      value: "secret_value_456"
    };

    const repSub = repManager.watch("env-var", ["schema.yaml"], ["add"]).subscribe(fileEvent => {
      repSub.unsubscribe();
      const yamlContent = fileEvent.content;
      const schema = YAML.parse(yamlContent);
      expect(schema).toEqual({
        _id: _id.toString(),
        key,
        value: "secret_value_456"
      });
      done();
    });

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      syncSub.unsubscribe();
      syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    envVarService.insertOne(testEnvVar);
  });

  it("should create pending sync when changes come from representative", done => {
    const envVarKey = "TEST_ENV_VAR_FROM_REP";
    const fileName = "schema";
    const fileExtension = "yaml";

    const envVarId = new ObjectId();
    const testEnvVar: EnvVar = {
      _id: envVarId,
      key: envVarKey,
      value: "rep_secret_value"
    };

    const envVarYaml = YAML.stringify(testEnvVar);

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      expect(sync.change_log).toEqual({
        _id: sync.change_log._id,
        module: "env-var",
        sub_module: "schema",
        origin: ChangeOrigin.REPRESENTATIVE,
        type: ChangeType.CREATE,
        resource_id: sync.change_log.resource_id,
        resource_slug: envVarKey,
        resource_content: envVarYaml,
        resource_extension: fileExtension,
        created_at: sync.change_log.created_at,
        initiator: ChangeInitiator.EXTERNAL
      });
      expect(sync.status).toBe(SyncStatuses.PENDING);
      syncSub.unsubscribe();
      done();
    });

    repManager.write("env-var", envVarKey, fileName, envVarYaml, fileExtension);
  });

  it("should sync changes from representative to documents after approval", done => {
    const envVarKey = "TEST_ENV_VAR_FROM_REP_APPROVED";
    const fileName = "schema";
    const fileExtension = "yaml";

    const envVarId = new ObjectId();
    const testEnvVar: EnvVar = {
      _id: envVarId,
      key: envVarKey,
      value: "approved_secret_value"
    };

    const envVarYaml = YAML.stringify(testEnvVar);

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(async sync => {
      syncSub.unsubscribe();
      await syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    const succeededSub = syncProcessor.watch(SyncStatuses.SUCCEEDED).subscribe(async () => {
      succeededSub.unsubscribe();
      const insertedEnvVar = await envVarService.findOne({_id: envVarId});
      expect(insertedEnvVar).toEqual({
        _id: envVarId,
        key: envVarKey,
        value: "approved_secret_value"
      });
      done();
    });

    repManager.write("env-var", envVarKey, fileName, envVarYaml, fileExtension);
  });
});
