import {Test, TestingModule} from "@nestjs/testing";
import {SyncEngine} from "../sync/engine/src/engine";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {
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
import {VersionControlModule} from "../src";
import {SyncProcessor} from "../processors/sync";

describe("SyncEngine Integration", () => {
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
  });

  afterEach(async () => {
    await module.close();
  });

  describe("change handlers", () => {
    describe("bucket", () => {
      beforeEach(() => {
        syncEngine.registerChangeHandler(getBucketSupplier(bs), getBucketApplier(bs, bds, hs));
      });

      it("should push sync to processor, but don't process until not approved", done => {
        const subs = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
          expect(new Date(sync.created_at)).toBeInstanceOf(Date);
          expect(sync.created_at).toEqual(sync.updated_at);
          expect(sync.status).toBe(SyncStatuses.PENDING);
          expect(sync.change_log).toEqual({
            module: "bucket",
            sub_module: "schema",
            origin: ChangeOrigin.DOCUMENT,
            type: ChangeType.CREATE,
            resource_id: _id.toHexString(),
            resource_slug: "Test Bucket",
            resource_content: JSON.stringify(bucket),
            resource_extension: "yaml"
          });
          subs.unsubscribe();
          done();
        });

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
        bs.insertOne(bucket);
      }, 10000);

      // it("should sync changes from document to representatives", done => {
      //   const _id = new ObjectId();
      //   const title = "Test Bucket";
      //   const subscription = repManager
      //     .watch("bucket", [`${title}/schema.yaml`], ["add"])
      //     .subscribe(async () => {
      //       await repManager.read("bucket", title, "schema.yaml").then(data => {
      //         const schema = JSON.parse(data.toString());
      //         expect(schema).toBe({
      //           ...bucket,
      //           _id: _id.toHexString()
      //         });
      //         subscription.unsubscribe();
      //         done();
      //       });
      //     });

      //   const bucket: Bucket = {
      //     _id,
      //     title,
      //     description: "A bucket for testing",
      //     primary: "name",
      //     acl: {
      //       read: "true",
      //       write: "true"
      //     },
      //     properties: {
      //       name: {
      //         type: "string",
      //         options: {
      //           position: "left"
      //         }
      //       }
      //     }
      //   };
      //   bs.insertOne(bucket);
      // }, 10000);
    });
  });
});
