import {Test, TestingModule} from "@nestjs/testing";
import {SyncEngine} from "../../sync/engine/src/engine";
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
  getApplier as getFunctionSchemaApplier,
  getSupplier as getFunctionSchemaSupplier
} from "@spica-server/function/src/synchronizer/schema";
import {
  FunctionService,
  ServicesModule as FunctionServicesModule
} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {LogService, LogModule} from "@spica-server/function/log";
import {SchedulerModule} from "@spica-server/function/scheduler";
import {Function, FUNCTION_OPTIONS} from "@spica-server/interface/function";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {VersionControlModule} from "../../src";
import {SyncProcessor} from "../../processors/sync";
import YAML from "yaml";
import fs from "fs";

describe("SyncEngine Integration - Function", () => {
  let module: TestingModule;
  let syncEngine: SyncEngine;
  let syncProcessor: SyncProcessor;
  let repManager: VCRepresentativeManager;

  let functionService: FunctionService;
  let functionEngine: FunctionEngine;
  let logs: LogService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        VersionControlModule.forRoot({
          isReplicationEnabled: false,
          persistentPath: join(tmpdir()),
          realtime: false
        }),
        SchedulerModule.forRoot({
          invocationLogs: false,
          databaseName: undefined,
          databaseReplicaSet: undefined,
          databaseUri: undefined,
          apiUrl: undefined,
          timeout: 60000,
          corsOptions: {
            allowedOrigins: ["*"],
            allowedMethods: ["*"],
            allowCredentials: true,
            allowedHeaders: ["*"]
          },
          maxConcurrency: 1,
          debug: false,
          logger: false,
          spawnEntrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH,
          tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH
        }),
        PreferenceTestingModule,
        FunctionServicesModule.forRoot({
          path: join(tmpdir(), "function_test_root"),
          entryLimit: 20,
          logExpireAfterSeconds: 60 * 60 * 24 * 7,
          realtimeLogs: false
        }),
        LogModule.forRoot({
          expireAfterSeconds: 60 * 60 * 24 * 7,
          realtime: false
        })
      ],
      providers: [
        FunctionEngine,
        {
          provide: FUNCTION_OPTIONS,
          useValue: {
            root: join(tmpdir(), "function_test_root"),
            timeout: 60,
            outDir: ".build"
          }
        }
      ]
    }).compile();

    syncEngine = module.get(SyncEngine);
    syncProcessor = module.get(SyncProcessor);
    repManager = module.get(VC_REPRESENTATIVE_MANAGER);

    functionService = module.get(FunctionService);
    functionEngine = module.get(FunctionEngine);
    logs = module.get(LogService);

    syncEngine.registerChangeHandler(
      getFunctionSchemaSupplier(functionService),
      getFunctionSchemaApplier(functionService, functionEngine, logs)
    );
  });

  afterEach(async () => {
    await module.close();
    const functionDir = join(tmpdir(), "function");
    if (fs.existsSync(functionDir)) {
      await fs.promises.rm(functionDir, {recursive: true, force: true});
    }
  });

  it("should push sync to processor, but don't process until not approved", done => {
    const _id = new ObjectId();
    const name = "Test Function";

    const testFunction: Function = {
      _id,
      name,
      description: "A function for testing",
      env_vars: [],
      triggers: {
        default: {
          type: "http",
          active: true,
          options: {
            method: "Get",
            path: "/test"
          }
        }
      },
      timeout: 60,
      language: "javascript"
    };

    const subs = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      expect(new Date(sync.created_at)).toBeInstanceOf(Date);
      expect(sync.created_at).toEqual(sync.updated_at);
      expect(sync.status).toBe(SyncStatuses.PENDING);
      expect(sync.change_log).toEqual({
        _id: sync.change_log._id,
        module: "function",
        sub_module: "schema",
        origin: ChangeOrigin.DOCUMENT,
        type: ChangeType.CREATE,
        resource_id: _id.toHexString(),
        resource_slug: name,
        resource_content: YAML.stringify(testFunction),
        resource_extension: "yaml",
        created_at: sync.change_log.created_at
      });
      subs.unsubscribe();
      done();
    });

    functionService.insertOne(testFunction);
  });

  it("should sync changes from document to representatives", done => {
    const _id = new ObjectId();
    const name = "Test Function Doc to Rep";

    const testFunction: Function = {
      _id,
      name,
      description: "A function for testing",
      env_vars: [],
      triggers: {
        default: {
          type: "http",
          active: true,
          options: {
            method: "Get",
            path: "/test"
          }
        }
      },
      timeout: 60,
      language: "javascript"
    };

    const repSub = repManager.watch("function", ["schema.yaml"], ["add"]).subscribe(fileEvent => {
      repSub.unsubscribe();
      const yamlContent = fileEvent.content;
      const schema = YAML.parse(yamlContent);
      expect(schema).toEqual({
        _id: _id.toString(),
        name,
        description: "A function for testing",
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/test"
            }
          }
        },
        timeout: 60,
        language: "javascript"
      });
      done();
    });

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      syncSub.unsubscribe();
      syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    functionService.insertOne(testFunction);
  });

  it("should create pending sync when changes come from representative", done => {
    const functionName = "Test Function from Rep";
    const fileName = "schema";
    const fileExtension = "yaml";

    const functionId = new ObjectId();
    const testFunction: Function = {
      _id: functionId,
      name: functionName,
      description: "A function for testing from representative",
      env_vars: [],
      triggers: {
        default: {
          type: "http",
          active: true,
          options: {
            method: "Post",
            path: "/rep-test"
          }
        }
      },
      timeout: 120,
      language: "javascript"
    };

    const functionYaml = YAML.stringify(testFunction);

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      expect(sync.change_log).toEqual({
        _id: sync.change_log._id,
        module: "function",
        sub_module: "schema",
        origin: ChangeOrigin.REPRESENTATIVE,
        type: ChangeType.CREATE,
        resource_id: sync.change_log.resource_id,
        resource_slug: functionName,
        resource_content: functionYaml,
        resource_extension: fileExtension,
        created_at: sync.change_log.created_at
      });
      expect(sync.status).toBe(SyncStatuses.PENDING);
      syncSub.unsubscribe();
      done();
    });

    repManager.write("function", functionName, fileName, functionYaml, fileExtension);
  });

  it("should sync changes from representative to documents after approval", done => {
    const functionName = "Test Function from Rep Approved";
    const fileName = "schema";
    const fileExtension = "yaml";

    const functionId = new ObjectId();
    const testFunction: Function = {
      _id: functionId,
      name: functionName,
      description: "A function for testing from representative with approval",
      env_vars: [],
      triggers: {
        default: {
          type: "http",
          active: true,
          options: {
            method: "Delete",
            path: "/rep-approved-test"
          }
        }
      },
      timeout: 90,
      language: "typescript"
    };

    const functionYaml = YAML.stringify(testFunction);

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(async sync => {
      syncSub.unsubscribe();
      await syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    const succeededSub = syncProcessor.watch(SyncStatuses.SUCCEEDED).subscribe(async sync => {
      succeededSub.unsubscribe();
      const insertedFunction = await functionService.findOne({_id: functionId});
      expect(insertedFunction).toEqual({
        _id: functionId,
        name: functionName,
        description: "A function for testing from representative with approval",
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Delete",
              path: "/rep-approved-test"
            }
          }
        },
        timeout: 90,
        language: "typescript"
      });
      done();
    });

    repManager.write("function", functionName, fileName, functionYaml, fileExtension);
  });
});
