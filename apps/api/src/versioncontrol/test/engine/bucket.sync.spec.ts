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
  getApplier as getBucketApplier,
  getSupplier as getBucketSupplier
} from "@spica-server/bucket/src/synchronizer/schema";
import {
  BucketDataService,
  BucketService,
  ServicesModule as BucketServiceModule
} from "@spica-server/bucket/services";
import {HistoryModule, HistoryService} from "@spica-server/bucket/history/";
import {Bucket} from "@spica-server/interface/bucket";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {VersionControlModule} from "../../src";
import {SyncProcessor} from "../../processors/sync";
import YAML from "yaml";
import fs from "fs";

describe("SyncEngine Integration - Bucket", () => {
  let module: TestingModule;
  let syncEngine: SyncEngine;
  let syncProcessor: SyncProcessor;
  let repManager: VCRepresentativeManager;

  let bs: BucketService;
  let bds: BucketDataService;
  let hs: HistoryService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        VersionControlModule.forRoot({
          isReplicationEnabled: false,
          persistentPath: join(tmpdir()),
          realtime: false
        }),
        BucketServiceModule.initialize(1000),
        HistoryModule.register(),
        PreferenceTestingModule
      ]
    }).compile();

    syncEngine = module.get(SyncEngine);
    syncProcessor = module.get(SyncProcessor);
    repManager = module.get(VC_REPRESENTATIVE_MANAGER);

    bs = module.get(BucketService);
    bds = module.get(BucketDataService);
    hs = module.get(HistoryService);

    syncEngine.registerChangeHandler(getBucketSupplier(bs), getBucketApplier(bs, bds, hs));
  });

  afterEach(async () => {
    await module.close();
    const bucketDir = join(tmpdir(), "bucket");
    if (fs.existsSync(bucketDir)) {
      await fs.promises.rm(bucketDir, {recursive: true, force: true});
    }
  });

  it("should push sync to processor, but don't process until not approved", done => {
    const _id = new ObjectId();
    const title = "Test Bucket";

    const bucket: Bucket = {
      _id,
      title,
      description: "A bucket for testing",
      primary: "name",
      acl: {
        read: "true",
        write: "true"
      },
      properties: {
        name: {
          type: "string",
          options: {
            position: "left"
          }
        }
      }
    };

    const subs = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      expect(new Date(sync.created_at)).toBeInstanceOf(Date);
      expect(sync.created_at).toEqual(sync.updated_at);
      expect(sync.status).toBe(SyncStatuses.PENDING);
      expect(sync.change_log).toEqual({
        _id: sync.change_log._id,
        module: "bucket",
        sub_module: "schema",
        origin: ChangeOrigin.DOCUMENT,
        type: ChangeType.CREATE,
        resource_id: _id.toHexString(),
        resource_slug: "Test Bucket",
        resource_content: YAML.stringify(bucket),
        resource_extension: "yaml",
        created_at: sync.change_log.created_at,
        initiator: ChangeInitiator.EXTERNAL
      });
      subs.unsubscribe();
      done();
    });

    bs.insertOne(bucket);
  });

  it("should sync changes from document to representatives", done => {
    const _id = new ObjectId();
    const title = "Test Bucket";

    const bucket: Bucket = {
      _id,
      title,
      description: "A bucket for testing",
      primary: "name",
      acl: {
        read: "true",
        write: "true"
      },
      properties: {
        name: {
          type: "string",
          options: {
            position: "left"
          }
        }
      }
    };

    const repSub = repManager.watch("bucket", ["schema.yaml"], ["add"]).subscribe(fileEvent => {
      repSub.unsubscribe();
      const yamlContent = fileEvent.content;
      const schema = YAML.parse(yamlContent);
      expect(schema).toEqual({
        _id: _id.toString(),
        title,
        description: "A bucket for testing",
        primary: "name",
        acl: {
          read: "true",
          write: "true"
        },
        properties: {
          name: {
            type: "string",
            options: {
              position: "left"
            }
          }
        }
      });
      done();
    });

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      syncSub.unsubscribe();
      syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    bs.insertOne(bucket);
  });

  it("should create pending sync when changes come from representative", done => {
    const bucketTitle = "Test Bucket from Rep";
    const fileName = "schema";
    const fileExtension = "yaml";

    const bucketId = new ObjectId();
    const bucket: Bucket = {
      _id: bucketId,
      title: bucketTitle,
      description: "A bucket for testing from representative",
      primary: "name",
      acl: {
        read: "true",
        write: "true"
      },
      properties: {
        name: {
          type: "string",
          options: {
            position: "left"
          }
        }
      }
    };

    const bucketYaml = YAML.stringify(bucket);

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      expect(sync.change_log).toEqual({
        _id: sync.change_log._id,
        module: "bucket",
        sub_module: "schema",
        origin: ChangeOrigin.REPRESENTATIVE,
        type: ChangeType.CREATE,
        resource_id: sync.change_log.resource_id,
        resource_slug: bucketTitle,
        resource_content: bucketYaml,
        resource_extension: fileExtension,
        created_at: sync.change_log.created_at,
        initiator: ChangeInitiator.EXTERNAL
      });
      expect(sync.status).toBe(SyncStatuses.PENDING);
      syncSub.unsubscribe();
      done();
    });

    repManager.write("bucket", bucketTitle, fileName, bucketYaml, fileExtension);
  });

  it("should sync changes from representative to documents after approval", done => {
    const bucketTitle = "Test Bucket from Rep Approved";
    const fileName = "schema";
    const fileExtension = "yaml";

    const bucketId = new ObjectId();
    const bucket: Bucket = {
      _id: bucketId,
      title: bucketTitle,
      description: "A bucket for testing from representative with approval",
      primary: "name",
      acl: {
        read: "true",
        write: "true"
      },
      properties: {
        name: {
          type: "string",
          options: {
            position: "left"
          }
        }
      }
    };

    const bucketYaml = YAML.stringify(bucket);

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(async sync => {
      syncSub.unsubscribe();
      await syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    bs.watchBucket(bucketId.toString(), false).subscribe(updatedBucket => {
      expect(updatedBucket).toEqual({
        _id: bucketId,
        title: bucketTitle,
        description: "A bucket for testing from representative with approval",
        primary: "name",
        acl: {
          read: "true",
          write: "true"
        },
        properties: {
          name: {
            type: "string",
            options: {
              position: "left"
            }
          }
        }
      });
      done();
    });
    repManager.write("bucket", bucketTitle, fileName, bucketYaml, fileExtension);
  });
});
