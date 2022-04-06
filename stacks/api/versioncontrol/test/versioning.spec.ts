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

  afterEach(async () => {
    await rep.delete("bucket", "").catch(() => {});
  });

  describe("Synchronization from database to files", () => {
    describe("bucket", () => {
      let bucket;
      let id: ObjectId;

      beforeEach(async () => {
        id = new ObjectId();
        bucket = {
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
      });
      it("should make first synchronization", async () => {
        await bs.insertOne(bucket);
        await synchronizer.synchronize(SyncDirection.DocToRep);

        const file = await rep.readResource("bucket", id.toString());
        expect(file).toEqual({schema: {...bucket, _id: id.toString()}});
      });

      it("should update if schema has changes", async () => {
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
        await bs.insertOne(bucket);
        await synchronizer.synchronize(SyncDirection.DocToRep);

        await bs.findOneAndDelete({_id: id});
        await synchronizer.synchronize(SyncDirection.DocToRep);

        const file = await rep.readResource("bucket", id.toString());
        expect(file).toEqual({});
      });
    });

    describe("function", () => {
      // seperating function tests will increase test duration
      // that's why we are testing all cases in one 'it'
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

        // SCHEMA INSERT
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

        // SCHEMA UPDATE
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

        // INDEX UPDATE
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

  describe("Synchronization from files to database", () => {
    describe("bucket", () => {
      let bucket;
      let id: string;

      beforeEach(async () => {
        id = new ObjectId().toHexString();
        bucket = {
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
      });

      it("should make first synchronization", async () => {
        await rep.write("bucket", id, "schema", bucket, "yaml");

        await synchronizer.synchronize(SyncDirection.RepToDoc);

        const buckets = await bs.find();
        expect(buckets).toEqual([{...bucket, _id: new ObjectId(id)}]);
      });

      it("should update if schema has changes", async () => {
        await rep.write("bucket", id, "schema", bucket, "yaml");
        await synchronizer.synchronize(SyncDirection.RepToDoc);

        await rep.write("bucket", id, "schema", {...bucket, title: "new title"}, "yaml");
        await synchronizer.synchronize(SyncDirection.RepToDoc);

        const buckets = await bs.find({});
        expect(buckets).toEqual([{...bucket, _id: new ObjectId(id), title: "new title"}]);
      });

      it("should delete if schema has been deleted", async () => {
        await rep.write("bucket", id, "schema", bucket, "yaml");
        await synchronizer.synchronize(SyncDirection.RepToDoc);

        await rep.delete("bucket", id);
        await synchronizer.synchronize(SyncDirection.RepToDoc);

        const buckets = await bs.find({});
        expect(buckets).toEqual([]);
      });
    });

    describe("function", () => {
      // seperating function tests will increase test duration
      // that's why we are testing all cases in one 'it'
      it("should sync changes", async () => {
        // SCHEMA INSERT
        const id = new ObjectId().toHexString();
        let fn = {
          _id: id,
          name: "fn1",
          env: {},
          language: "javascript",
          timeout: 100,
          triggers: {}
        };
        await rep.write("function", id, "schema", fn, "yaml");

        let index = "console.log('hi')";
        await rep.write("function", id, "index", index, "ts");

        let packages: any = {
          dependencies: {}
        };
        await rep.write("function", id, "package", packages, "json");

        await synchronizer.synchronize(SyncDirection.RepToDoc);

        let fns = await fs.find();
        expect(fns).toEqual([{...fn, _id: new ObjectId(id)}]);

        packages = await engine.getPackages(fn);
        expect(packages).toEqual([]);

        index = await engine.read(fn);
        expect(index).toEqual("console.log('hi')");

        // SCHEMA UPDATE
        const onCall = {
          type: "http",
          active: true,
          options: {}
        };
        await rep.write("function", id, "schema", {...fn, triggers: {onCall}}, "yaml");

        await synchronizer.synchronize(SyncDirection.RepToDoc);

        fns = await fs.find();
        expect(fns).toEqual([{...fn, triggers: {onCall}, _id: new ObjectId(id)}]);

        // INDEX UPDATES
        index = "console.log('hi2')";
        await rep.write("function", id, "index", index, "ts");

        await synchronizer.synchronize(SyncDirection.RepToDoc);

        index = await engine.read(fn);
        expect(index).toEqual("console.log('hi2')");

        // SCHEMA DELETE
        await rep.delete("function", id);

        await synchronizer.synchronize(SyncDirection.RepToDoc);

        fns = await fs.find();
        expect(fns).toEqual([]);

        packages = await engine.getPackages(fn);
        expect(packages).toEqual([]);

        await engine.read(fn).catch(e => {
          expect(e).toEqual("Not Found");
        });
      }, 20000);
    });
  });
});
