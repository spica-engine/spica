import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {BucketService} from "@spica-server/bucket/services";
import {CoreTestingModule} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {FunctionModule} from "@spica-server/function";
import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {Synchronizer, ApiMachineryModule, RepresentativeManager} from "@spica-server/machinery";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import * as os from "os";

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
          ApiMachineryModule,
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
          })
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

        await synchronizer.synchronize();

        const file = await rep.read("bucket", id.toString());

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
        await synchronizer.synchronize();

        await bs.updateOne({_id: id}, {$set: {"properties.title.type": "number"}});
        await synchronizer.synchronize();

        const file = await rep.read("bucket", id.toString());
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
        await synchronizer.synchronize();

        await bs.findOneAndDelete({_id: id});
        await synchronizer.synchronize();

        // it takes some time to remove
        const file = await rep.read("bucket", id.toString());
        expect(file).toEqual({});
      });
    });

    fdescribe("function", () => {
      it("should make initial function sync", async () => {
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

        await synchronizer.synchronize();

        const file = await rep.read("function", id.toString());
        expect(file).toEqual({
          index: "",
          package: {dependencies: []},
          schema: {...fn, _id: id.toString()}
        });
      });

      it("should update if function meta has changes", async () => {
        const id = new ObjectId();
        const fn: any = {
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

        fn.triggers.new_trigger = {
          type: "http",
          active: true,
          options: {}
        };
        await fs.findOneAndReplace({_id: id}, fn);

        await synchronizer.synchronize();

        const file = await rep.read("function", id.toString());
        expect(file).toEqual({
          index: "",
          package: {dependencies: []},
          schema: {...fn, _id: id.toString()}
        });
      });

      it("should update if function index has changes", async () => {
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

        await engine.update(fn, "console.log(123)");

        await synchronizer.synchronize();

        const file = await rep.read("function", id.toString());
        expect(file).toEqual({
          index: "console.log(123)",
          package: {dependencies: []},
          schema: {...fn, _id: id.toString()}
        });
      });

      xit("should update if function dependencies have changes", async () => {
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

        await engine.addPackage(fn, "debug@4.1.1").toPromise();

        await synchronizer.synchronize();

        const file = await rep.read("function", id.toString());
        expect(file).toEqual({
          index: "",
          package: {dependencies: [{name: "debug", version: "4.1.1"}]},
          schema: {...fn, _id: id.toString()}
        });
      });
    });
  });
});
