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
import os from "os";
import {VersionControlModule} from "@spica-server/versioncontrol";
import {VC_REPRESENTATIVE_MANAGER} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import {PreferenceModule} from "@spica-server/preference";
import {PreferenceService} from "@spica-server/preference/services";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {EnvVarService} from "@spica-server/env_var/services";
import {EnvVarModule} from "@spica-server/env_var";
import YAML from "yaml";
import path from "path";
import fs from "fs";
import * as fnCRUD from "@spica-server/function/src/crud";
import {v4 as uuidv4} from "uuid";
import {PolicyModule, PolicyService} from "@spica-server/passport/policy";

const sleep = (value = 5000) => new Promise(r => setTimeout(r, value));

describe("Versioning", () => {
  let module: TestingModule;
  let app: INestApplication;
  let bs: BucketService;
  let rep: VCRepresentativeManager;
  let fnservice: FunctionService;
  let engine: FunctionEngine;
  let evs: EnvVarService;
  let ps: PolicyService;
  let directoryPath: string;

  async function readResource(module: string, id: string): Promise<any> {
    const moduleDir = rep.getModuleDir(module);
    const resourcesPath = path.join(moduleDir, id);
    const contents = {};

    if (!fs.existsSync(resourcesPath)) {
      return Promise.resolve(contents);
    }

    let resources = fs.readdirSync(resourcesPath);
    const promises: Promise<any>[] = [];

    for (const resource of resources) {
      const resourcePath = path.join(resourcesPath, resource);

      const promise = fs.promises.readFile(resourcePath).then(content => {
        const extension = resource.split(".").pop();
        const key = resource.replace(`.${extension}`, "");
        contents[key] = content.toString();
      });
      promises.push(promise);
    }

    await Promise.all(promises);
    return {_id: id, contents};
  }

  beforeEach(async () => {
    directoryPath = path.join(os.tmpdir(), uuidv4());
    fs.mkdirSync(directoryPath, {recursive: true});

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
          invocationLogs: false,
          path: directoryPath,
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
          logger: false,
          spawnEntrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH,
          tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH,
          realtime: false
        }),
        EnvVarModule.forRoot({realtime: false}),
        VersionControlModule.forRoot({
          persistentPath: directoryPath,
          isReplicationEnabled: false
        }),
        PolicyModule.forRoot({realtime: false})
      ]
    }).compile();

    module.enableShutdownHooks();

    app = module.createNestApplication();
    bs = module.get(BucketService);
    rep = module.get(VC_REPRESENTATIVE_MANAGER);

    fnservice = module.get(FunctionService);
    engine = module.get(FunctionEngine);
    evs = module.get(EnvVarService);
    ps = module.get(PolicyService);
    await sleep();
  });

  afterEach(async () => {
    await rep.rm();
    await app.close();
    const functionsDir = path.join(directoryPath, "functions");
    fs.rmSync(functionsDir, {recursive: true, force: true});
  });

  describe("preference", () => {
    const defaultPref = {scope: "passport", identity: {attributes: {}}};
    let module: TestingModule;
    let app: INestApplication;
    let rep: VCRepresentativeManager;
    let prefService: PreferenceService;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.replicaSet(),
          PreferenceModule.forRoot(),
          VersionControlModule.forRoot({persistentPath: directoryPath, isReplicationEnabled: false})
        ]
      }).compile();

      app = module.createNestApplication();

      rep = module.get(VC_REPRESENTATIVE_MANAGER);
      prefService = module.get(PreferenceService);

      prefService.default(defaultPref);
      await sleep();
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
            await sleep();
          });

          it("should do the initial sync", async () => {
            const file = await readResource("preference", "identity");
            const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};
            expect(parsedFile).toEqual({
              _id: "identity",
              contents: {schema: preference.identity}
            });
          });

          it("should update if schema has changes", async () => {
            await prefService.updateOne(
              {scope: "passport"},
              {$set: {"identity.attributes.properties.name.type": "number"}}
            );
            await sleep();

            const file = await readResource("preference", "identity");
            const parsedFile = {
              ...file,
              slug: "identity",
              contents: {schema: YAML.parse(file.contents.schema)}
            };

            const expectedSchema = {...preference.identity};
            expectedSchema.attributes.properties.name.type = "number";

            expect(parsedFile).toEqual({
              _id: "identity",
              slug: "identity",
              contents: {schema: expectedSchema}
            });
          });
        });

        describe("Representative to document", () => {
          beforeEach(async () => {
            const stringified = YAML.stringify(preference.identity);
            await rep.write("preference", "identity", "schema", stringified, "yaml");
            await sleep();
          });

          it("should do the initial synchronization", async () => {
            const document = await prefService.findOne({scope: "passport"});
            delete document._id;
            expect(document).toEqual(preference);
          });

          it("should update if schema has changes", async () => {
            const updatedSchema = {...preference.identity};
            updatedSchema.attributes.properties.name.type = "number";
            const stringified = YAML.stringify(updatedSchema);

            await rep.write("preference", "identity", "schema", stringified, "yaml");
            await sleep();

            const document = await prefService.findOne({scope: "passport"});
            delete document._id;
            expect(document).toEqual({...preference, identity: updatedSchema});
          });

          it("should delete if schema is deleted", async () => {
            await rep.rm("preference", "identity");
            await sleep();
            const document = await prefService.findOne({scope: "passport"});
            delete document._id;
            expect(document).toEqual(defaultPref);
          });
        });
      });
    });
  });

  afterEach(async () => {
    await rep.rm().catch(console.warn);
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
        await sleep();

        const file = await readResource("bucket", bucket.title);
        const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};

        expect(parsedFile).toEqual({
          _id: bucket.title,
          contents: {schema: {...bucket, _id: id.toString()}}
        });
      });

      it("should update if schema has changes", async () => {
        await bs.insertOne(bucket);
        await sleep();

        await bs.updateOne({_id: id}, {$set: {"properties.title.type": "number"}});
        await sleep();

        const file = await readResource("bucket", bucket.title);
        const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};

        const expectedBucket = {...bucket, _id: id.toString()};
        expectedBucket.properties.title.type = "number";

        expect(parsedFile).toEqual({
          _id: bucket.title,
          contents: {
            schema: expectedBucket
          }
        });
      });

      it("should delete if schema has been deleted", async () => {
        await bs.insertOne(bucket);
        await sleep();

        await bs.deleteOne({_id: id});
        await sleep();

        const file = await readResource("bucket", bucket.title);
        expect(file).toEqual({});
      });
    });

    describe("Synchronization from files to database", () => {
      it("should make first synchronization", async () => {
        const stringified = YAML.stringify(bucket);
        await rep.write("bucket", bucket.title, "schema", stringified, "yaml");
        await sleep();

        const buckets = await bs.find();
        expect(buckets).toEqual([{...bucket, _id: id}]);
      });

      it("should update if schema has changes", async () => {
        const stringified = YAML.stringify(bucket);
        await rep.write("bucket", bucket.title, "schema", stringified, "yaml");
        await sleep();

        const updated = YAML.stringify({...bucket, title: "new title"});
        await rep.write("bucket", bucket.title, "schema", updated, "yaml");
        await sleep();

        const buckets = await bs.find({});
        expect(buckets).toEqual([{...bucket, _id: id, title: "new title"}]);
      });

      it("should delete if schema has been deleted", async () => {
        const stringified = YAML.stringify(bucket);
        await rep.write("bucket", bucket.title, "schema", stringified, "yaml");
        await sleep();
        await rep.rm("bucket", bucket.title);
        await sleep();

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
          language: "javascript",
          timeout: 100,
          triggers: {}
        };

        // SCHEMA INSERT
        await fnCRUD.insert(fnservice, engine, fn);
        await fnCRUD.index.write(fnservice, engine, id, "");

        await sleep();

        let file = await readResource("function", fn.name);
        let parsedFile = {
          ...file,
          contents: {
            ...file.contents,
            schema: YAML.parse(file.contents.schema),
            package: YAML.parse(file.contents.package)
          }
        };
        const expectedSchema = {...fn, _id: id.toHexString()};

        expect(parsedFile).toEqual({
          _id: fn.name,
          contents: {
            index: "",
            package: {dependencies: {}},
            schema: expectedSchema
          }
        });

        // SCHEMA UPDATE
        const onCall = {
          type: "http",
          active: true,
          options: {}
        };
        await fnservice.findOneAndUpdate({_id: id}, {$set: {"triggers.onCall": onCall}});
        await sleep();

        file = await readResource("function", fn.name);
        parsedFile = {
          ...file,
          contents: {
            ...file.contents,
            schema: YAML.parse(file.contents.schema),
            package: YAML.parse(file.contents.package)
          }
        };

        expect(parsedFile).toEqual({
          _id: fn.name,
          contents: {
            index: "",
            package: {dependencies: {}},
            schema: {...expectedSchema, triggers: {onCall}}
          }
        });

        // INDEX UPDATE
        await engine.update(fn, "console.log(123)");
        await sleep();

        file = await readResource("function", fn.name);
        parsedFile = {
          ...file,
          contents: {
            ...file.contents,
            schema: YAML.parse(file.contents.schema),
            package: YAML.parse(file.contents.package)
          }
        };

        expect(parsedFile).toEqual({
          _id: fn.name,
          contents: {
            index: "console.log(123)",
            package: {dependencies: {}},
            schema: {...expectedSchema, triggers: {onCall}}
          }
        });

        // SCHEMA DELETE
        await fnservice.findOneAndDelete({_id: id});
        await sleep();

        file = await readResource("function", fn.name);
        expect(file).toEqual({});
        // we can not install dependency on test environment
      });
    });

    describe("Synchronization from files to database", () => {
      it("should sync changes", async () => {
        // SCHEMA INSERT
        const id = new ObjectId().toHexString();
        let fn = {
          _id: id,
          name: "fn1",
          language: "javascript",
          timeout: 100,
          triggers: {}
        };
        const stringified = YAML.stringify(fn);
        await rep.write("function", fn.name, "schema", stringified, "yaml");
        await sleep();

        let index = "console.log('hi')";
        await rep.write("function", fn.name, "index", index, "ts");
        await sleep();

        let packages: any = {
          dependencies: {}
        };
        const stringifiedPackages = YAML.stringify(packages);
        await rep.write("function", fn.name, "package", stringifiedPackages, "json");
        await sleep();

        let fns = await fnservice.find();
        expect(fns).toEqual([
          {
            ...fn,
            _id: new ObjectId(id)
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
        const stringifiedSchema = YAML.stringify({...fn, triggers: {onCall}});
        await rep.write("function", fn.name, "schema", stringifiedSchema, "yaml");
        await sleep();

        fns = await fnservice.find();
        expect(fns).toEqual([
          {
            ...fn,
            triggers: {onCall},
            _id: new ObjectId(id)
          }
        ]);

        // INDEX UPDATES
        index = "console.log('hi2')";
        await rep.write("function", fn.name, "index", index, "ts");
        await sleep();

        index = await engine.read(fn);
        expect(index).toEqual("console.log('hi2')");

        // SCHEMA DELETE
        await rep.rm("function", fn.name);
        await sleep();

        fns = await fnservice.find();
        expect(fns).toEqual([]);

        packages = await engine.getPackages(fn);
        expect(packages).toEqual([]);

        await engine.read(fn).catch(e => {
          expect(e).toEqual("Not Found");
        });
      });
    });
  });

  describe("environment variables", () => {
    let envVar;
    let id: ObjectId;

    beforeEach(async () => {
      id = new ObjectId();
      envVar = {
        _id: id,
        key: "IGNORE_ERRORS",
        value: "true"
      };
      await sleep();
    });

    describe("Synchronization from database to files", () => {
      it("should make first synchronization", async () => {
        await evs.insertOne(envVar);
        await sleep();

        const file = await readResource("env-var", envVar.key);
        const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};

        expect(parsedFile).toEqual({
          _id: envVar.key,
          contents: {schema: {_id: id.toString(), key: "IGNORE_ERRORS", value: "true"}}
        });
      });

      it("should update if schema has changes", async () => {
        await evs.insertOne(envVar);
        await sleep();

        await evs.updateOne({_id: id}, {$set: {value: "false"}});
        await sleep();

        const file = await readResource("env-var", envVar.key);
        const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};

        expect(parsedFile).toEqual({
          _id: envVar.key,
          contents: {schema: {_id: id.toString(), key: "IGNORE_ERRORS", value: "false"}}
        });
      });

      it("should delete if schema has been deleted", async () => {
        await evs.insertOne(envVar);
        await sleep();

        await evs.findOneAndDelete({_id: id});
        await sleep();

        const file = await readResource("env-var", envVar.key);
        expect(file).toEqual({});
      });
    });

    describe("Synchronization from files to database", () => {
      it("should make first synchronization", async () => {
        const stringified = YAML.stringify(envVar);
        await rep.write("env-var", envVar.key, "schema", stringified, "yaml");
        await sleep();

        const envVars = await evs.find();
        expect(envVars).toEqual([{...envVar, _id: id}]);
      });

      it("should update if schema has changes", async () => {
        const stringified = YAML.stringify(envVar);
        await rep.write("env-var", envVar.key, "schema", stringified, "yaml");
        await sleep();

        const updated = YAML.stringify({...envVar, value: "false"});
        await rep.write("env-var", envVar.key, "schema", updated, "yaml");
        await sleep();

        const envVars = await evs.find({});
        expect(envVars).toEqual([
          {
            _id: id,
            key: "IGNORE_ERRORS",
            value: "false"
          }
        ]);
      });

      it("should delete if schema has been deleted", async () => {
        const stringified = YAML.stringify(envVar);
        await rep.write("env-var", envVar.key, "schema", stringified, "yaml");
        await sleep();

        await rep.rm("env-var", envVar.key);
        await sleep();

        const envVars = await evs.find({});
        expect(envVars).toEqual([]);
      });
    });
  });

  describe("policy", () => {
    let policy;
    let id: ObjectId;

    beforeEach(async () => {
      id = new ObjectId();
      policy = {
        _id: id,
        name: "Test Policy",
        description: "Test Policy description",
        statement: [
          {
            action: "bucket:create",
            module: "bucket",
            resource: "*"
          }
        ]
      };
      await sleep();
    });

    describe("Synchronization from database to files", () => {
      it("should make first synchronization", async () => {
        await ps.insertOne(policy);
        await sleep();

        const file = await readResource("policy", policy.name);

        const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};

        expect(parsedFile).toEqual({
          _id: policy.name,
          contents: {
            schema: {
              _id: id.toString(),
              name: "Test Policy",
              description: "Test Policy description",
              statement: [
                {
                  action: "bucket:create",
                  module: "bucket",
                  resource: "*"
                }
              ]
            }
          }
        });
      });

      it("should update if schema has changes", async () => {
        await ps.insertOne(policy);
        await sleep();

        await ps.updateOne({_id: id as any}, {$set: {value: "false"}});
        await sleep();

        const file = await readResource("policy", policy.name);
        const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};

        expect(parsedFile).toEqual({
          _id: policy.name,
          contents: {
            schema: {
              _id: id.toString(),
              name: "Test Policy",
              description: "Test Policy description",
              statement: [
                {
                  action: "bucket:create",
                  module: "bucket",
                  resource: "*"
                }
              ],
              value: "false"
            }
          }
        });
      });

      it("should delete if schema has been deleted", async () => {
        await ps.insertOne(policy);
        await sleep();

        await ps.findOneAndDelete({_id: id as any});
        await sleep();

        const file = await readResource("policy", policy.name);
        expect(file).toEqual({});
      });
    });

    describe("Synchronization from files to database", () => {
      it("should make first synchronization", async () => {
        const stringified = YAML.stringify(policy);
        await rep.write("policy", policy.name, "schema", stringified, "yaml");
        await sleep();

        const policies = await ps.find();
        expect(policies).toEqual([{...policy, _id: id}]);
      });

      it("should update if schema has changes", async () => {
        const stringified = YAML.stringify(policy);
        await rep.write("policy", policy.name, "schema", stringified, "yaml");
        await sleep();

        const updated = YAML.stringify({...policy, value: "false"});
        await rep.write("policy", policy.name, "schema", updated, "yaml");
        await sleep();

        const policies = await ps.find({});
        expect(policies).toEqual([
          {
            _id: id,
            name: "Test Policy",
            description: "Test Policy description",
            statement: [
              {
                action: "bucket:create",
                module: "bucket",
                resource: "*"
              }
            ],
            value: "false"
          }
        ]);
      });

      it("should delete if schema has been deleted", async () => {
        const stringified = YAML.stringify(policy);
        await rep.write("policy", policy.name, "schema", stringified, "yaml");
        await sleep();

        await rep.rm("policy", policy.name);
        await sleep();

        const policies = await ps.find({});
        expect(policies).toEqual([]);
      });
    });
  });
});
