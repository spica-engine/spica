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
  SyncDirection,
  VersionControlModule,
  Synchronizer,
  VC_REP_MANAGER
} from "@spica-server/versioncontrol";
import {RepresentativeManager} from "@spica/representative";
import {PreferenceModule} from "@spica-server/preference";
import {PreferenceService} from "@spica-server/preference/services";
import {PassportTestingModule} from "@spica-server/passport/testing";

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
        PassportTestingModule.initialize(),
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
          realtimeLogs: false,
          logger: false
        }),
        VersionControlModule.forRoot({persistentPath: os.tmpdir()})
      ]
    }).compile();

    app = module.createNestApplication();
    synchronizer = module.get(Synchronizer);
    bs = module.get(BucketService);
    rep = module.get(VC_REP_MANAGER);

    fs = module.get(FunctionService);
    engine = module.get(FunctionEngine);
  });

  describe("preference", () => {
    const defaultPref = {scope: "passport", identity: {attributes: {}}};
    let module: TestingModule;
    let app: INestApplication;
    let synchronizer: Synchronizer;
    let rep: RepresentativeManager;
    let prefService: PreferenceService;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.replicaSet(),
          PreferenceModule.forRoot(),
          VersionControlModule.forRoot({persistentPath: os.tmpdir()})
        ]
      }).compile();

      app = module.createNestApplication();

      synchronizer = module.get(Synchronizer);
      rep = module.get(VC_REP_MANAGER);
      prefService = module.get(PreferenceService);

      prefService.default(defaultPref);
    });

    describe("passport", () => {
      describe("identity", () => {
        let preference;

        beforeEach(async () => {
          preference = {
            scope: "passport",
            identity: {
              attributes: {
                properties: {
                  name: {
                    type: "string",
                    title: "Name",
                    description: "Name of the user"
                  }
                }
              }
            }
          };
        });

        describe("Document to representative", () => {
          beforeEach(async () => {
            await prefService.insertOne(preference);
            await synchronizer.synchronize(SyncDirection.DocToRep);
          });
          it("should do the initial sync", async () => {
            const file = await rep.readResource("preference", "identity");
            expect(file).toEqual({_id: "identity", contents: {schema: preference.identity}});
          });

          it("should update if schema has changes", async () => {
            await prefService.updateOne(
              {scope: "passport"},
              {$set: {"identity.attributes.properties.name.type": "number"}}
            );
            await synchronizer.synchronize(SyncDirection.DocToRep);

            const file = await rep.readResource("preference", "identity");
            const expectedSchema = {...preference.identity};
            expectedSchema.attributes.properties.name.type = "number";
            expect(file).toEqual({_id: "identity", contents: {schema: expectedSchema}});
          });

          it("should delete if schema has been deleted", async () => {
            await prefService.deleteOne({scope: "passport"});
            await synchronizer.synchronize(SyncDirection.DocToRep);

            // it returns the default schema
            const file = await rep.readResource("preference", "identity");
            expect(file).toEqual({
              _id: "identity",
              contents: {schema: defaultPref.identity}
            });
          });
        });

        describe("Representative to document", () => {
          beforeEach(async () => {
            await rep.write("preference", "identity", "schema", preference.identity, "yaml");
            await synchronizer.synchronize(SyncDirection.RepToDoc);
          });

          it("should do the initial synchronization", async () => {
            const document = await prefService.findOne({scope: "passport"});
            delete document._id;
            expect(document).toEqual(preference);
          });

          it("should update if schema has changes", async () => {
            const updatedSchema = {...preference.identity};
            updatedSchema.attributes.properties.name.type = "number";

            await rep.write("preference", "identity", "schema", updatedSchema, "yaml");
            await synchronizer.synchronize(SyncDirection.RepToDoc);

            const document = await prefService.findOne({scope: "passport"});
            delete document._id;
            expect(document).toEqual({...preference, identity: updatedSchema});
          });

          it("should delete if schema is deleted", async () => {
            await rep.rm("preference", "identity");
            await synchronizer.synchronize(SyncDirection.RepToDoc);

            const document = await prefService.findOne({scope: "passport"});
            delete document._id;
            expect(document).toEqual(defaultPref);
          });
        });
      });
    });
  });

  afterEach(async () => {
    await rep.rm("bucket").catch(() => {});
    await rep.rm("function").catch(() => {});
    await rep.rm("preference").catch(() => {});
  });

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

    describe("Synchronization from database to files", () => {
      it("should make first synchronization", async () => {
        await bs.insertOne(bucket);
        await synchronizer.synchronize(SyncDirection.DocToRep);

        const file = await rep.readResource("bucket", id.toString());
        expect(file).toEqual({
          _id: id.toHexString(),
          contents: {schema: {...bucket, _id: id.toString()}}
        });
      });

      it("should update if schema has changes", async () => {
        await bs.insertOne(bucket);
        await synchronizer.synchronize(SyncDirection.DocToRep);

        await bs.updateOne({_id: id}, {$set: {"properties.title.type": "number"}});
        await synchronizer.synchronize(SyncDirection.DocToRep);

        const file = await rep.readResource("bucket", id.toString());
        const expectedBucket = {...bucket, _id: id.toString()};
        expectedBucket.properties.title.type = "number";

        expect(file).toEqual({
          _id: id.toHexString(),
          contents: {
            schema: expectedBucket
          }
        });
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

    describe("Synchronization from files to database", () => {
      it("should make first synchronization", async () => {
        await rep.write("bucket", id.toHexString(), "schema", bucket, "yaml");

        await synchronizer.synchronize(SyncDirection.RepToDoc);

        const buckets = await bs.find();
        expect(buckets).toEqual([{...bucket, _id: id}]);
      });

      it("should update if schema has changes", async () => {
        await rep.write("bucket", id.toHexString(), "schema", bucket, "yaml");
        await synchronizer.synchronize(SyncDirection.RepToDoc);

        await rep.write(
          "bucket",
          id.toHexString(),
          "schema",
          {...bucket, title: "new title"},
          "yaml"
        );
        await synchronizer.synchronize(SyncDirection.RepToDoc);

        const buckets = await bs.find({});
        expect(buckets).toEqual([{...bucket, _id: id, title: "new title"}]);
      });

      it("should delete if schema has been deleted", async () => {
        await rep.write("bucket", id.toHexString(), "schema", bucket, "yaml");
        await synchronizer.synchronize(SyncDirection.RepToDoc);

        await rep.rm("bucket", id.toHexString());
        await synchronizer.synchronize(SyncDirection.RepToDoc);

        const buckets = await bs.find({});
        expect(buckets).toEqual([]);
      });
    });
  });

  describe("function", () => {
    describe("Synchronization from database to files", () => {
      // seperating function tests will increase test duration
      // that's why we are testing all cases in one 'it'
      it("should sync changes", async () => {
        const id = new ObjectId();
        const fn = {
          _id: id,
          name: "fn1",
          env: {
            APIKEY: "SECRET",
            BUCKET_ID: "SOME_ID"
          },
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
        const expectedSchema = {...fn, _id: id.toHexString()};
        expectedSchema.env = {
          APIKEY: "{APIKEY}",
          BUCKET_ID: "{BUCKET_ID}"
        };

        // console.dir(file,{depth:Infinity})
        expect(file).toEqual({
          _id: id.toHexString(),
          contents: {
            index: "",
            package: {dependencies: {}},
            schema: expectedSchema,
            env: {
              APIKEY: "SECRET",
              BUCKET_ID: "SOME_ID"
            }
          }
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
          _id: id.toHexString(),
          contents: {
            index: "",
            package: {dependencies: {}},
            schema: {...expectedSchema, triggers: {onCall}},
            env: {
              APIKEY: "SECRET",
              BUCKET_ID: "SOME_ID"
            }
          }
        });

        // INDEX UPDATE
        await engine.update(fn, "console.log(123)");
        await synchronizer.synchronize(SyncDirection.DocToRep);

        file = await rep.readResource("function", id.toString());
        expect(file).toEqual({
          _id: id.toHexString(),
          contents: {
            index: "console.log(123)",
            package: {dependencies: {}},
            schema: {...expectedSchema, triggers: {onCall}},
            env: {
              APIKEY: "SECRET",
              BUCKET_ID: "SOME_ID"
            }
          }
        });

        // SCHEMA DELETE
        await fs.findOneAndDelete({_id: id});
        await synchronizer.synchronize(SyncDirection.DocToRep);

        file = await rep.readResource("function", id.toString());
        expect(file).toEqual({});
        // we can not install dependency on test environment
      }, 20000);
    });

    describe("Synchronization from files to database", () => {
      it("should sync changes", async () => {
        // SCHEMA INSERT
        const id = new ObjectId().toHexString();
        let fn = {
          _id: id,
          name: "fn1",
          env: {
            APIKEY: "{APIKEY}",
            BUCKET_ID: "{BUCKET_ID}"
          },
          language: "javascript",
          timeout: 100,
          triggers: {}
        };
        await rep.write("function", id, "schema", fn, "yaml");

        const env = {
          APIKEY: "SECRET",
          BUCKET_ID: "SOME_ID"
        };
        await rep.write("function", id, "env", env, "env");

        let index = "console.log('hi')";
        await rep.write("function", id, "index", index, "ts");

        let packages: any = {
          dependencies: {}
        };
        await rep.write("function", id, "package", packages, "json");

        await synchronizer.synchronize(SyncDirection.RepToDoc);

        let fns = await fs.find();
        expect(fns).toEqual([
          {
            ...fn,
            _id: new ObjectId(id),
            env: {
              APIKEY: "SECRET",
              BUCKET_ID: "SOME_ID"
            }
          }
        ]);

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
        expect(fns).toEqual([
          {
            ...fn,
            triggers: {onCall},
            _id: new ObjectId(id),
            env: {
              APIKEY: "SECRET",
              BUCKET_ID: "SOME_ID"
            }
          }
        ]);

        // INDEX UPDATES
        index = "console.log('hi2')";
        await rep.write("function", id, "index", index, "ts");

        await synchronizer.synchronize(SyncDirection.RepToDoc);

        index = await engine.read(fn);
        expect(index).toEqual("console.log('hi2')");

        // SCHEMA DELETE
        await rep.rm("function", id);

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
