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
  getApplier as getPolicyApplier,
  getSupplier as getPolicySupplier
} from "@spica-server/passport/policy/src/synchronizer/schema";
import {PolicyService} from "@spica-server/passport/policy";
import {Policy} from "@spica-server/interface/passport/policy";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {VersionControlModule} from "../../src";
import {SyncProcessor} from "../../processors/sync";
import YAML from "yaml";
import fs from "fs";

xdescribe("SyncEngine Integration - Policy", () => {
  let module: TestingModule;
  let syncEngine: SyncEngine;
  let syncProcessor: SyncProcessor;
  let repManager: VCRepresentativeManager;

  let policyService: PolicyService;

  const mockApikeyFinalizer = async () => {};
  const mockIdentityFinalizer = async () => {};

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
      providers: [PolicyService]
    }).compile();

    syncEngine = module.get(SyncEngine);
    syncProcessor = module.get(SyncProcessor);
    repManager = module.get(VC_REPRESENTATIVE_MANAGER);

    policyService = module.get(PolicyService);

    syncEngine.registerChangeHandler(
      getPolicySupplier(policyService),
      getPolicyApplier(policyService, mockApikeyFinalizer, mockIdentityFinalizer)
    );
  });

  afterEach(async () => {
    await module.close();

    const policyDir = join(tmpdir(), "policy");
    if (fs.existsSync(policyDir)) {
      await fs.promises.rm(policyDir, {recursive: true, force: true});
    }
  });

  it("should push sync to processor, but don't process until not approved", done => {
    const _id = new ObjectId();
    const name = "Test Policy";

    const testPolicy: Policy = {
      _id,
      name,
      description: "A policy for testing",
      statement: [
        {
          module: "bucket:data",
          action: "bucket:data:index",
          resource: "*"
        }
      ]
    };

    const subs = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      expect(new Date(sync.created_at)).toBeInstanceOf(Date);
      expect(sync.created_at).toEqual(sync.updated_at);
      expect(sync.status).toBe(SyncStatuses.PENDING);
      expect(sync.change_log).toEqual({
        _id: sync.change_log._id,
        module: "policy",
        sub_module: "schema",
        origin: ChangeOrigin.DOCUMENT,
        type: ChangeType.CREATE,
        resource_id: _id.toHexString(),
        resource_slug: name,
        resource_content: YAML.stringify(testPolicy),
        resource_extension: "yaml",
        created_at: sync.change_log.created_at,
        initiator: ChangeInitiator.EXTERNAL
      });
      subs.unsubscribe();
      done();
    });

    policyService.insertOne(testPolicy);
  });

  it("should sync changes from document to representatives", done => {
    const _id = new ObjectId();
    const name = "Test Policy Doc to Rep";

    const testPolicy: Policy = {
      _id,
      name,
      description: "A policy for testing",
      statement: [
        {
          module: "bucket:data",
          action: "bucket:data:show",
          resource: "bucket_id/*"
        }
      ]
    };

    const repSub = repManager.watch("policy", ["schema.yaml"], ["add"]).subscribe(fileEvent => {
      repSub.unsubscribe();
      const yamlContent = fileEvent.content;
      const schema = YAML.parse(yamlContent);
      expect(schema).toEqual({
        _id: _id.toString(),
        name,
        description: "A policy for testing",
        statement: [
          {
            module: "bucket:data",
            action: "bucket:data:show",
            resource: "bucket_id/*"
          }
        ]
      });
      done();
    });

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      syncSub.unsubscribe();
      syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    policyService.insertOne(testPolicy);
  });

  it("should create pending sync when changes come from representative", done => {
    const policyName = "Test Policy from Rep";
    const fileName = "schema";
    const fileExtension = "yaml";

    const policyId = new ObjectId();
    const testPolicy: Policy = {
      _id: policyId,
      name: policyName,
      description: "A policy for testing from representative",
      statement: [
        {
          module: "function",
          action: "function:index",
          resource: "*"
        }
      ]
    };

    const policyYaml = YAML.stringify(testPolicy);

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      expect(sync.change_log).toEqual({
        _id: sync.change_log._id,
        module: "policy",
        sub_module: "schema",
        origin: ChangeOrigin.REPRESENTATIVE,
        type: ChangeType.CREATE,
        resource_id: sync.change_log.resource_id,
        resource_slug: policyName,
        resource_content: policyYaml,
        resource_extension: fileExtension,
        created_at: sync.change_log.created_at,
        initiator: ChangeInitiator.EXTERNAL
      });
      expect(sync.status).toBe(SyncStatuses.PENDING);
      syncSub.unsubscribe();
      done();
    });

    repManager.write("policy", policyName, fileName, policyYaml, fileExtension);
  });

  it("should sync changes from representative to documents after approval", done => {
    const policyName = "Test Policy from Rep Approved";
    const fileName = "schema";
    const fileExtension = "yaml";

    const policyId = new ObjectId();
    const testPolicy: Policy = {
      _id: policyId,
      name: policyName,
      description: "A policy for testing from representative with approval",
      statement: [
        {
          module: "storage",
          action: "storage:index",
          resource: "*"
        }
      ]
    };

    const policyYaml = YAML.stringify(testPolicy);

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(async sync => {
      syncSub.unsubscribe();
      await syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    const succeededSub = syncProcessor.watch(SyncStatuses.SUCCEEDED).subscribe(async () => {
      succeededSub.unsubscribe();
      const insertedPolicy = await policyService.findOne({_id: policyId});
      expect(insertedPolicy).toEqual({
        _id: policyId,
        name: policyName,
        description: "A policy for testing from representative with approval",
        statement: [
          {
            module: "storage",
            action: "storage:index",
            resource: "*"
          }
        ]
      });
      done();
    });

    repManager.write("policy", policyName, fileName, policyYaml, fileExtension);
  });
});
