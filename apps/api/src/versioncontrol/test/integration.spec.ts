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
import {
  ChangeTypes,
  ResourceType,
  VC_REPRESENTATIVE_MANAGER
} from "@spica-server/interface/versioncontrol";
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
import {Subject, firstValueFrom, Subscription, zip, map, tap} from "rxjs";
import {getDocWatcher} from "../src/synchronizer/doc.synchronizer";

const sleep = (value = 3000) => new Promise(r => setTimeout(r, value));

describe("Versioning", () => {
  const performAndWaitUntilReflected = (subjects: Subject<any>[], action: Promise<any>) => {
    return firstValueFrom(zip(...subjects.map(subject => firstValueFrom(subject)), action));
  };

  const initializeRepWatcher = (
    rep: VCRepresentativeManager,
    moduleName: string,
    slug: string,
    fileSubjectMap: {
      [fileName: string]: {
        insert: Subject<any>;
        update: Subject<any>;
        delete: Subject<any>;
      };
    }
  ) => {
    const getRepWatcher = (moduleName, fileName) => rep.watch(moduleName, [fileName]);
    const getChangeHandler =
      (subjects: {insert: Subject<any>; update: Subject<any>; delete: Subject<any>}) => change => {
        if (change.resource.slug !== slug) return;

        switch (change.changeType) {
          case ChangeTypes.INSERT:
            subjects.insert.next(change);
            break;
          case ChangeTypes.UPDATE:
            subjects.update.next(change);
            break;
          case ChangeTypes.DELETE:
            subjects.delete.next(change);
            break;
        }
      };

    const subs: Subscription[] = [];
    Object.entries(fileSubjectMap).forEach(([fileName, subjects]) => {
      subs.push(getRepWatcher(moduleName, fileName).subscribe(getChangeHandler(subjects)));
    });
    return subs;
  };

  const initializeDocWatcher = (
    service: FunctionService | PreferenceService | BucketService | PolicyService | EnvVarService,
    resourceId: ObjectId | string,
    subjectMap: {
      insert: Subject<any>;
      update: Subject<any>;
      delete: Subject<any>;
    }
  ) => {
    const schemaWatcher = getDocWatcher({
      collectionService: service as any,
      skipInitialEmit: true
    });
    const getChangeHandler =
      (subjects: {insert: Subject<any>; update: Subject<any>; delete: Subject<any>}) => change => {
        if (String(change.resource._id) !== String(resourceId)) return;

        switch (change.changeType) {
          case ChangeTypes.INSERT:
            subjects.insert.next(change);
            break;
          case ChangeTypes.UPDATE:
            subjects.update.next(change);
            break;
          case ChangeTypes.DELETE:
            subjects.delete.next(change);
            break;
        }
      };

    const subs: Subscription[] = [];
    subs.push(schemaWatcher().subscribe(getChangeHandler(subjectMap)));
    return subs;
  };

  async function readResource(
    rep: VCRepresentativeManager,
    module: string,
    id: string
  ): Promise<any> {
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

  describe("preference", () => {
    const defaultPref = {scope: "passport", identity: {attributes: {}}};
    let module: TestingModule;
    let app: INestApplication;
    let rep: VCRepresentativeManager;
    let prefService: PreferenceService;
    let directoryPath: string;

    beforeEach(async () => {
      directoryPath = path.join(os.tmpdir(), uuidv4());
      fs.mkdirSync(directoryPath, {recursive: true});

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

    afterEach(async () => {
      await rep.rm().catch(console.warn);
      await app.close();
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
          let subs: Subscription[];
          let onSchemaInserted = new Subject<any>();
          let onSchemaUpdated = new Subject<any>();
          let onSchemaDeleted = new Subject<any>();

          beforeEach(async () => {
            subs = initializeRepWatcher(rep, "preference", "identity", {
              "schema.yaml": {
                insert: onSchemaInserted,
                update: onSchemaUpdated,
                delete: onSchemaDeleted
              }
            });

            await performAndWaitUntilReflected(
              [onSchemaInserted],
              prefService.insertOne(preference)
            );
          });

          afterEach(() => {
            subs.forEach(s => s.unsubscribe());
          });

          it("should do the initial sync", async () => {
            const file = await readResource(rep, "preference", "identity");
            const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};
            expect(parsedFile).toEqual({
              _id: "identity",
              contents: {schema: preference.identity}
            });
          });

          it("should update if schema has changes", async () => {
            const updatePreference = () =>
              prefService.updateOne(
                {scope: "passport"},
                {$set: {"identity.attributes.properties.name.type": "number"}}
              );
            await performAndWaitUntilReflected([onSchemaUpdated], updatePreference());

            const file = await readResource(rep, "preference", "identity");
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
          let subs: Subscription[];
          let onSchemaInserted = new Subject<any>();
          let onSchemaUpdated = new Subject<any>();
          let onSchemaDeleted = new Subject<any>();

          beforeEach(() => {
            const prefWatcher = prefService.watch("passport", {propagateOnStart: false}).pipe(
              map(preference => ({
                resourceType: ResourceType.DOCUMENT,
                changeType: ChangeTypes.UPDATE,
                resource: {
                  _id: "identity",
                  slug: "identity",
                  content: {...preference.identity, _id: "identity"}
                }
              }))
            );

            const getChangeHandler = subjects => change => {
              if (change.resource._id !== "identity") return;

              switch (change.changeType) {
                case ChangeTypes.INSERT:
                  subjects[0].next(change);
                  break;
                case ChangeTypes.UPDATE:
                  subjects[1].next(change);
                  break;
                case ChangeTypes.DELETE:
                  subjects[2].next(change);
                  break;
              }
            };

            subs = [
              prefWatcher.subscribe(
                getChangeHandler([onSchemaInserted, onSchemaUpdated, onSchemaDeleted])
              )
            ];
          });

          afterEach(() => {
            subs.forEach(s => s.unsubscribe());
          });

          beforeEach(async () => {
            const stringified = YAML.stringify(preference.identity);
            await performAndWaitUntilReflected(
              [onSchemaUpdated],
              rep.write("preference", "identity", "schema", stringified, "yaml")
            );
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

            await performAndWaitUntilReflected(
              [onSchemaUpdated],
              rep.write("preference", "identity", "schema", stringified, "yaml")
            );

            const document = await prefService.findOne({scope: "passport"});
            delete document._id;
            expect(document).toEqual({...preference, identity: updatedSchema});
          });

          it("should delete if schema is deleted", async () => {
            await performAndWaitUntilReflected([onSchemaUpdated], rep.rm("preference", "identity"));
            const document = await prefService.findOne({scope: "passport"});
            delete document._id;
            expect(document).toEqual(defaultPref);
          });
        });
      });
    });
  });

  describe("common", () => {
    let module: TestingModule;
    let app: INestApplication;
    let bs: BucketService;
    let rep: VCRepresentativeManager;
    let fnservice: FunctionService;
    let engine: FunctionEngine;
    let evs: EnvVarService;
    let ps: PolicyService;
    let directoryPath: string;

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
      await rep.rm().catch(console.warn);
      await app.close();
    });

    describe("bucket", () => {
      let bucket;
      let id: ObjectId;
      const bucketTitle = "bucket1";

      beforeEach(async () => {
        id = new ObjectId();
        bucket = {
          _id: id,
          title: bucketTitle,
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
        let subs: Subscription[];
        let onSchemaInserted = new Subject<any>();
        let onSchemaUpdated = new Subject<any>();
        let onSchemaDeleted = new Subject<any>();

        beforeEach(async () => {
          subs = initializeRepWatcher(rep, "bucket", bucketTitle, {
            "schema.yaml": {
              insert: onSchemaInserted,
              update: onSchemaUpdated,
              delete: onSchemaDeleted
            }
          });

          await performAndWaitUntilReflected([onSchemaInserted], bs.insertOne(bucket));
        });

        afterEach(() => {
          subs.forEach(s => s.unsubscribe());
        });

        it("should make first synchronization", async () => {
          const file = await readResource(rep, "bucket", bucket.title);
          const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};

          expect(parsedFile).toEqual({
            _id: bucket.title,
            contents: {schema: {...bucket, _id: id.toString()}}
          });
        });

        it("should update if schema has changes", async () => {
          const updateBucket = () =>
            bs.updateOne({_id: id}, {$set: {"properties.title.type": "number"}});
          await performAndWaitUntilReflected([onSchemaUpdated], updateBucket());

          const file = await readResource(rep, "bucket", bucket.title);
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
          const deleteBucket = () => bs.deleteOne({_id: id});
          await performAndWaitUntilReflected([onSchemaDeleted], deleteBucket());

          const file = await readResource(rep, "bucket", bucket.title);
          expect(file).toEqual({});
        });
      });

      describe("Synchronization from files to database", () => {
        let subs: Subscription[];
        let onSchemaInserted = new Subject<any>();
        let onSchemaUpdated = new Subject<any>();
        let onSchemaDeleted = new Subject<any>();

        beforeEach(async () => {
          subs = initializeDocWatcher(bs, id, {
            insert: onSchemaInserted,
            update: onSchemaUpdated,
            delete: onSchemaDeleted
          });

          const stringified = YAML.stringify(bucket);
          const insertBucket = () =>
            rep.write("bucket", bucket.title, "schema", stringified, "yaml");
          await performAndWaitUntilReflected([onSchemaInserted], insertBucket());
        });

        afterEach(() => {
          subs.forEach(s => s.unsubscribe());
        });

        it("should make first synchronization", async () => {
          const buckets = await bs.find();
          expect(buckets).toEqual([{...bucket, _id: id}]);
        });

        it("should update if schema has changes", async () => {
          const updated = YAML.stringify({...bucket, title: "new title"});
          await performAndWaitUntilReflected(
            [onSchemaUpdated],
            rep.write("bucket", bucket.title, "schema", updated, "yaml")
          );

          const buckets = await bs.find({});
          expect(buckets).toEqual([{...bucket, _id: id, title: "new title"}]);
        });

        it("should delete if schema has been deleted", async () => {
          await performAndWaitUntilReflected([onSchemaDeleted], rep.rm("bucket", bucket.title));

          const buckets = await bs.find({});
          expect(buckets).toEqual([]);
        });
      });
    });

    describe("function", () => {
      afterEach(() => {
        const functionsDir = path.join(directoryPath, "functions");
        fs.rmSync(functionsDir, {recursive: true, force: true});
      });

      describe("Synchronization from database to files", () => {
        let subs: Subscription[];
        let onSchemaInserted = new Subject<any>();
        let onSchemaUpdated = new Subject<any>();
        let onSchemaDeleted = new Subject<any>();

        let onIndexInserted = new Subject<any>();
        let onIndexUpdated = new Subject<any>();
        let onIndexDeleted = new Subject<any>();

        let onPackageInserted = new Subject<any>();
        let onPackageUpdated = new Subject<any>();
        let onPackageDeleted = new Subject<any>();

        const fnName = "fn1";

        beforeEach(() => {
          subs = initializeRepWatcher(rep, "function", fnName, {
            "schema.yaml": {
              insert: onSchemaInserted,
              update: onSchemaUpdated,
              delete: onSchemaDeleted
            },
            "index.js": {
              insert: onIndexInserted,
              update: onIndexUpdated,
              delete: onIndexDeleted
            },
            "package.json": {
              insert: onPackageInserted,
              update: onPackageUpdated,
              delete: onPackageDeleted
            }
          });
        });

        afterEach(() => {
          subs.forEach(s => s.unsubscribe());
        });
        // separating function tests will increase test duration
        // that's why we are testing all cases in one 'it'
        it("should sync changes", async () => {
          const id = new ObjectId();
          const fn = {
            _id: id,
            name: fnName,
            language: "javascript",
            timeout: 100,
            triggers: {}
          };

          // SCHEMA INSERT
          const insertFn = () =>
            fnCRUD
              .insert(fnservice, engine, fn)
              .then(() => fnCRUD.index.write(fnservice, engine, id, ""));

          await performAndWaitUntilReflected(
            [onSchemaInserted, onIndexInserted, onPackageInserted],
            insertFn()
          );

          let file = await readResource(rep, "function", fn.name);
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

          const updateSchema = () =>
            fnservice.findOneAndUpdate({_id: id}, {$set: {"triggers.onCall": onCall}});

          await performAndWaitUntilReflected([onSchemaUpdated], updateSchema());

          file = await readResource(rep, "function", fn.name);
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
          const updateIndex = () => engine.update(fn, "console.log(123)");
          await performAndWaitUntilReflected([onIndexUpdated], updateIndex());

          file = await readResource(rep, "function", fn.name);
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
          const deleteSchema = () => fnservice.findOneAndDelete({_id: id});
          await performAndWaitUntilReflected([onSchemaDeleted], deleteSchema());

          file = await readResource(rep, "function", fn.name);
          expect(file).toEqual({});
          // we can not install dependency on test environment
        });
      });

      describe("Synchronization from files to database", () => {
        let subs: Subscription[];
        let onSchemaInserted = new Subject<any>();
        let onSchemaUpdated = new Subject<any>();
        let onSchemaDeleted = new Subject<any>();

        let onIndexInserted = new Subject<any>();
        let onIndexUpdated = new Subject<any>();
        let onIndexDeleted = new Subject<any>();

        let onPackageInserted = new Subject<any>();
        let onPackageUpdated = new Subject<any>();
        let onPackageDeleted = new Subject<any>();

        const fnId = new ObjectId().toHexString();

        beforeEach(() => {
          const dbSubs = initializeDocWatcher(fnservice, fnId, {
            insert: onSchemaInserted,
            update: onSchemaUpdated,
            delete: onSchemaDeleted
          });
          // TODO: reduce copy-pasted code
          const convertEngineChange = ({fn: change, changeType}) => {
            return {
              resourceType: ResourceType.DOCUMENT,
              changeType: changeType == "add" ? ChangeTypes.INSERT : ChangeTypes.UPDATE,
              resource: {
                _id: change._id.toString(),
                slug: change.name,
                content: {...change, content: change.content}
              }
            };
          };
          const indexWatcher = engine.watch("index").pipe(map(convertEngineChange));
          const packageWatcher = engine.watch("dependency").pipe(map(convertEngineChange));

          const getChangeHandler = subjects => change => {
            if (change.resource._id !== fnId) return;

            switch (change.changeType) {
              case ChangeTypes.INSERT:
                subjects[0].next(change);
                break;
              case ChangeTypes.UPDATE:
                subjects[1].next(change);
                break;
              case ChangeTypes.DELETE:
                subjects[2].next(change);
                break;
            }
          };

          subs = [
            ...dbSubs,
            indexWatcher.subscribe(
              getChangeHandler([onIndexInserted, onIndexUpdated, onIndexDeleted])
            ),
            packageWatcher.subscribe(
              getChangeHandler([onPackageInserted, onPackageUpdated, onPackageDeleted])
            )
          ];
        });

        afterEach(() => {
          subs.forEach(s => s.unsubscribe());
        });

        it("should sync changes", async () => {
          // SCHEMA INSERT

          let fn = {
            _id: fnId,
            name: "fn1",
            language: "javascript",
            timeout: 100,
            triggers: {}
          };
          const stringified = YAML.stringify(fn);

          const insertSchema = () => rep.write("function", fn.name, "schema", stringified, "yaml");

          let index = "console.log('hi')";
          const insertIndex = () => rep.write("function", fn.name, "index", index, "ts");

          let packages: any = {
            dependencies: {}
          };
          const stringifiedPackages = YAML.stringify(packages);
          const insertPackage = () =>
            rep.write("function", fn.name, "package", stringifiedPackages, "json");

          await performAndWaitUntilReflected([onSchemaInserted], insertSchema());
          let fns = await fnservice.find();
          expect(fns).toEqual([
            {
              ...fn,
              _id: new ObjectId(fnId)
            }
          ]);

          await performAndWaitUntilReflected([onPackageInserted], insertPackage());
          packages = await engine.getPackages(fn);
          expect(packages).toEqual([]);

          await performAndWaitUntilReflected([onIndexUpdated], insertIndex());
          index = await engine.read(fn);
          expect(index).toEqual("console.log('hi')");

          // SCHEMA UPDATE
          const onCall = {
            type: "http",
            active: true,
            options: {}
          };
          const stringifiedSchema = YAML.stringify({...fn, triggers: {onCall}});

          const updateSchema = () =>
            rep.write("function", fn.name, "schema", stringifiedSchema, "yaml");
          await performAndWaitUntilReflected([onSchemaUpdated], updateSchema());
          fns = await fnservice.find();
          expect(fns).toEqual([
            {
              ...fn,
              triggers: {onCall},
              _id: new ObjectId(fnId)
            }
          ]);

          // INDEX UPDATES
          index = "console.log('hi2')";
          const updateIndex = () => rep.write("function", fn.name, "index", index, "ts");
          await performAndWaitUntilReflected([onIndexUpdated], updateIndex());

          index = await engine.read(fn);
          expect(index).toEqual("console.log('hi2')");

          // SCHEMA DELETE
          const deleteSchema = () => rep.rm("function", fn.name);
          await performAndWaitUntilReflected([onSchemaDeleted], deleteSchema());

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
      const key = "IGNORE_ERRORS";

      beforeEach(async () => {
        id = new ObjectId();
        envVar = {
          _id: id,
          key: key,
          value: "true"
        };
      });

      describe("Synchronization from database to files", () => {
        let subs: Subscription[];
        let onSchemaInserted = new Subject<any>();
        let onSchemaUpdated = new Subject<any>();
        let onSchemaDeleted = new Subject<any>();

        beforeEach(async () => {
          subs = initializeRepWatcher(rep, "env-var", key, {
            "schema.yaml": {
              insert: onSchemaInserted,
              update: onSchemaUpdated,
              delete: onSchemaDeleted
            }
          });
          await performAndWaitUntilReflected([onSchemaInserted], evs.insertOne(envVar));
        });

        afterEach(() => {
          subs.forEach(s => s.unsubscribe());
        });

        it("should make first synchronization", async () => {
          const file = await readResource(rep, "env-var", envVar.key);
          const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};

          expect(parsedFile).toEqual({
            _id: envVar.key,
            contents: {schema: {_id: id.toString(), key: "IGNORE_ERRORS", value: "true"}}
          });
        });

        it("should update if schema has changes", async () => {
          await performAndWaitUntilReflected(
            [onSchemaUpdated],
            evs.updateOne({_id: id}, {$set: {value: "false"}})
          );

          const file = await readResource(rep, "env-var", envVar.key);
          const parsedFile = {...file, contents: {schema: YAML.parse(file.contents.schema)}};

          expect(parsedFile).toEqual({
            _id: envVar.key,
            contents: {schema: {_id: id.toString(), key: "IGNORE_ERRORS", value: "false"}}
          });
        });

        it("should delete if schema has been deleted", async () => {
          await performAndWaitUntilReflected([onSchemaDeleted], evs.findOneAndDelete({_id: id}));
          const file = await readResource(rep, "env-var", envVar.key);
          expect(file).toEqual({});
        });
      });

      describe("Synchronization from files to database", () => {
        let subs: Subscription[];
        let onSchemaInserted = new Subject<any>();
        let onSchemaUpdated = new Subject<any>();
        let onSchemaDeleted = new Subject<any>();

        beforeEach(async () => {
          subs = initializeDocWatcher(evs, id, {
            insert: onSchemaInserted,
            update: onSchemaUpdated,
            delete: onSchemaDeleted
          });

          const stringified = YAML.stringify(envVar);
          const insertEnvVar = () =>
            rep.write("env-var", envVar.key, "schema", stringified, "yaml");
          await performAndWaitUntilReflected([onSchemaInserted], insertEnvVar());
        });

        afterEach(() => {
          subs.forEach(s => s.unsubscribe());
        });

        it("should make first synchronization", async () => {
          const envVars = await evs.find();
          expect(envVars).toEqual([{...envVar, _id: id}]);
        });

        it("should update if schema has changes", async () => {
          const updated = YAML.stringify({...envVar, value: "false"});
          await performAndWaitUntilReflected(
            [onSchemaUpdated],
            rep.write("env-var", envVar.key, "schema", updated, "yaml")
          );

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
          await performAndWaitUntilReflected([onSchemaDeleted], rep.rm("env-var", envVar.key));
          const envVars = await evs.find({});
          expect(envVars).toEqual([]);
        });
      });
    });

    describe("policy", () => {
      let policy;
      let id: ObjectId;
      const policyName = "Test Policy";

      beforeEach(async () => {
        id = new ObjectId();
        policy = {
          _id: id,
          name: policyName,
          description: "Test Policy description",
          statement: [
            {
              action: "bucket:create",
              module: "bucket",
              resource: "*"
            }
          ]
        };
      });

      describe("Synchronization from database to files", () => {
        let subs: Subscription[];
        let onSchemaInserted = new Subject<any>();
        let onSchemaUpdated = new Subject<any>();
        let onSchemaDeleted = new Subject<any>();

        beforeEach(async () => {
          subs = initializeRepWatcher(rep, "policy", policyName, {
            "schema.yaml": {
              insert: onSchemaInserted,
              update: onSchemaUpdated,
              delete: onSchemaDeleted
            }
          });
          await performAndWaitUntilReflected([onSchemaInserted], ps.insertOne(policy));
        });

        afterEach(() => {
          subs.forEach(s => s.unsubscribe());
        });

        it("should make first synchronization", async () => {
          const file = await readResource(rep, "policy", policy.name);

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
          await performAndWaitUntilReflected(
            [onSchemaUpdated],
            ps.updateOne({_id: id as any}, {$set: {value: "false"}})
          );

          const file = await readResource(rep, "policy", policy.name);
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
          await performAndWaitUntilReflected(
            [onSchemaDeleted],
            ps.findOneAndDelete({_id: id as any})
          );
          const file = await readResource(rep, "policy", policy.name);
          expect(file).toEqual({});
        });
      });

      describe("Synchronization from files to database", () => {
        let subs: Subscription[];
        let onSchemaInserted = new Subject<any>();
        let onSchemaUpdated = new Subject<any>();
        let onSchemaDeleted = new Subject<any>();

        beforeEach(async () => {
          subs = initializeDocWatcher(ps, id, {
            insert: onSchemaInserted,
            update: onSchemaUpdated,
            delete: onSchemaDeleted
          });

          const stringified = YAML.stringify(policy);
          const insertPolicy = () =>
            rep.write("policy", policy.name, "schema", stringified, "yaml");
          await performAndWaitUntilReflected([onSchemaInserted], insertPolicy());
        });

        afterEach(() => {
          subs.forEach(s => s.unsubscribe());
        });

        it("should make first synchronization", async () => {
          const policies = await ps.find();
          expect(policies).toEqual([{...policy, _id: id}]);
        });

        it("should update if schema has changes", async () => {
          const updated = YAML.stringify({...policy, value: "false"});
          await performAndWaitUntilReflected(
            [onSchemaUpdated],
            rep.write("policy", policy.name, "schema", updated, "yaml")
          );

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
          await performAndWaitUntilReflected([onSchemaDeleted], rep.rm("policy", policy.name));
          const policies = await ps.find({});
          expect(policies).toEqual([]);
        });
      });
    });
  });
});
