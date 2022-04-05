import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {BucketService} from "@spica-server/bucket/services";
import {CoreTestingModule} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {FunctionModule} from "@spica-server/function";
import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import * as os from "os";

import {
  Synchronizer,
  RepresentativeManager,
  SyncDirection,
  VersionControlModule
} from "@spica-server/versioncontrol";

describe("Versioning", () => {
  describe("Synchronization between database and files", () => {
    let module: TestingModule;
    let app: INestApplication;
    let synchronizer: Synchronizer;
    let bs: BucketService;
    let rep: RepresentativeManager;
    let fs: FunctionService;
    let engine: FunctionEngine;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          CoreTestingModule,
          DatabaseTestingModule.replicaSet(),
          PreferenceTestingModule,
          BucketModule.forRoot({
            hooks: false,
            history: false,
            realtime: false,
            cache: false,
            graphql: false
          }),
          FunctionModule.forRoot({
            path: os.tmpdir(),
            databaseName: undefined,
            databaseReplicaSet: undefined,
            databaseUri: undefined,
            apiUrl: undefined,
            timeout: 20,
            corsOptions: {
              allowCredentials: true,
              allowedHeaders: ["*"],
              allowedMethods: ["*"],
              allowedOrigins: ["*"]
            },
            logExpireAfterSeconds: 60,
            maxConcurrency: 1,
            debug: false,
            realtimeLogs: false
          }),
          VersionControlModule
        ]
      }).compile();

      app = module.createNestApplication();
      synchronizer = module.get(Synchronizer);
      bs = module.get(BucketService);
      rep = module.get(RepresentativeManager);

      fs = module.get(FunctionService);
      engine = module.get(FunctionEngine);
    });

    describe("bucket", () => {
      it("should make first synchronization", async () => {
        const id = new ObjectId();
        const bucket: any = {
          _id: id,
          title: "bucket1",
          properties: {
            title: {
              type: "string",
              options: {position: "bottom"}
            }
          },
          acl: {read: "true==true", write: "true==true"},
          primary: "title"
        };

        await bs.insertOne(bucket);

        await synchronizer.synchronize(SyncDirection.DocToRep);

        const file = await rep.readResource("bucket", id.toString());

        expect(file).toEqual({schema: {...bucket, _id: id.toString()}});
      });

      it("should update if schema has changes", async () => {
        const id = new ObjectId();
        const bucket: any = {
          _id: id,
          title: "bucket1",
          properties: {
            title: {
              type: "string",
              options: {position: "bottom"}
            }
          },
          acl: {read: "true==true", write: "true==true"},
          primary: "title"
        };

        await bs.insertOne(bucket);
        await synchronizer.synchronize(SyncDirection.DocToRep);

        await bs.updateOne({_id: id}, {$set: {"properties.title.type": "number"}});
        await synchronizer.synchronize(SyncDirection.DocToRep);

        const file = await rep.readResource("bucket", id.toString());
        const expectedBucket = {...bucket, _id: id.toString()};
        expectedBucket.properties.title.type = "number";

        expect(file).toEqual({schema: expectedBucket});
      });

      it("should delete if schema has been deleted", async () => {
        const id = new ObjectId();
        const bucket: any = {
          _id: id,
          title: "bucket1",
          properties: {
            title: {
              type: "string",
              options: {position: "bottom"}
            }
          },
          acl: {read: "true==true", write: "true==true"},
          primary: "title"
        };

        await bs.insertOne(bucket);
        await synchronizer.synchronize(SyncDirection.DocToRep);

        await bs.findOneAndDelete({_id: id});
        await synchronizer.synchronize(SyncDirection.DocToRep);

        const file = await rep.readResource("bucket", id.toString());
        expect(file).toEqual({});
      });
    });

    describe("function", () => {
      it("should sync changes", async () => {
        const id = new ObjectId();
        const fn = {
          _id: id,
          name: "fn1",
          env: {},
          language: "javascript",
          timeout: 100,
          triggers: {}
        };

        await fs.insertOne(fn);
        await engine.createFunction(fn);
        await engine.update(fn, "");
        await engine.compile(fn);

        await new Promise(resolve => setTimeout(resolve, 2000));

        await synchronizer.synchronize(SyncDirection.DocToRep);

        let file = await rep.readResource("function", id.toString());
        expect(file).toEqual({
          index: "",
          package: {dependencies: {}},
          schema: {...fn, _id: id.toString()}
        });

        // SCHEMA UPDATES
        const onCall = {
          type: "http",
          active: true,
          options: {}
        };
        await fs.findOneAndUpdate({_id: id}, {$set: {"triggers.onCall": onCall}});
        await synchronizer.synchronize(SyncDirection.DocToRep);

        file = await rep.readResource("function", id.toString());
        expect(file).toEqual({
          index: "",
          package: {dependencies: {}},
          schema: {...fn, _id: id.toString(), triggers: {onCall}}
        });

        // INDEX UPDATES
        await engine.update(fn, "console.log(123)");
        await synchronizer.synchronize(SyncDirection.DocToRep);

        file = await rep.readResource("function", id.toString());
        expect(file).toEqual({
          index: "console.log(123)",
          package: {dependencies: {}},
          schema: {...fn, _id: id.toString(), triggers: {onCall}}
        });

        // SCHEMA DELETE
        await fs.findOneAndDelete({_id: id});
        await synchronizer.synchronize(SyncDirection.DocToRep);

        file = await rep.readResource("function", id.toString());
        expect(file).toEqual({});
        // we can not install dependency on test environment
      }, 20000);
    });
  });
});
