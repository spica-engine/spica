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
  getApplier as getFunctionDependencyApplier,
  getSupplier as getFunctionDependencySupplier
} from "@spica-server/function/src/synchronizer/dependency";
import {
  FunctionService,
  ServicesModule as FunctionServicesModule
} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {LogModule} from "@spica-server/function/log";
import {SchedulerModule} from "@spica-server/function/scheduler";
import {Function, FUNCTION_OPTIONS} from "@spica-server/interface/function";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {VersionControlModule} from "../../src";
import {SyncProcessor} from "../../processors/sync";
import fs from "fs";
import * as CRUD from "@spica-server/function/src/crud";

describe("SyncEngine Integration - Function Dependency", () => {
  let module: TestingModule;
  let syncEngine: SyncEngine;
  let syncProcessor: SyncProcessor;
  let repManager: VCRepresentativeManager;

  let functionService: FunctionService;
  let functionEngine: FunctionEngine;

  const functionRoot = join(tmpdir(), "function_dependency_test_root");

  const createTestFunction = async (_id: ObjectId, name: string): Promise<Function> => {
    const testFunction: Function = {
      _id,
      name,
      description: "A function for dependency testing",
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
    await CRUD.insertSchema(functionService, functionEngine, testFunction);
    return testFunction;
  };

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
          path: functionRoot,
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
            root: functionRoot,
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

    syncEngine.registerChangeHandler(
      getFunctionDependencySupplier(functionEngine, functionService),
      getFunctionDependencyApplier(functionService, functionEngine)
    );
  });

  afterEach(async () => {
    await module.close();
    if (fs.existsSync(functionRoot)) {
      await fs.promises.rm(functionRoot, {recursive: true, force: true});
    }
  });

  it("should push sync to processor", done => {
    const _id = new ObjectId();
    const name = "TestFuncDep";

    const packageJsonContent = {
      name: name,
      description: "A function for dependency testing",
      version: "0.0.1",
      private: true,
      keywords: ["spica", "function", "node.js"],
      license: "UNLICENSED",
      main: `.build/${name}/index.mjs`
    };

    createTestFunction(_id, name).then(async fn => {
      const subs = syncProcessor.watch(SyncStatuses.PENDING).subscribe(async sync => {
        subs.unsubscribe();
        expect(new Date(sync.created_at)).toBeInstanceOf(Date);
        expect(sync.status).toBe(SyncStatuses.PENDING);
        expect(sync.change_log).toEqual({
          _id: sync.change_log._id,
          module: "function",
          sub_module: "package",
          origin: ChangeOrigin.DOCUMENT,
          type: ChangeType.CREATE,
          resource_id: _id.toString(),
          resource_slug: name,
          resource_content: JSON.stringify(packageJsonContent, null, 2),
          resource_extension: "json",
          created_at: sync.change_log.created_at,
          initiator: ChangeInitiator.EXTERNAL
        });
        done();
      });
      CRUD.dependencies.create(functionService, functionEngine, fn._id, packageJsonContent);
    });
  });

  it("should sync dependency from document to representatives", done => {
    const _id = new ObjectId();
    const name = "TestFuncDepDocToRep";
    const packageJsonContent = {
      name: name,
      description: "A function for dependency testing",
      version: "0.0.1",
      private: true,
      keywords: ["spica", "function", "node.js"],
      license: "UNLICENSED",
      main: `.build/${name}/index.mjs`
    };
    createTestFunction(_id, name).then(async fn => {
      const repSub = repManager
        .watch("function", ["package.json"], ["add", "change"])
        .subscribe(fileEvent => {
          repSub.unsubscribe();
          expect(JSON.parse(fileEvent.content)).toEqual(packageJsonContent);
          done();
        });

      const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
        syncSub.unsubscribe();
        syncProcessor.update(sync._id, SyncStatuses.APPROVED);
      });
      CRUD.dependencies.create(functionService, functionEngine, fn._id, packageJsonContent);
    });
  });

  it("should create pending sync when package.json changes come from representative", done => {
    const name = "TestFuncDepFromRep";
    const fileName = "package";
    const fileExtension = "json";
    const packageContent = JSON.stringify(
      {
        name: "TestFuncDepFromRep",
        description: "A function for dependency testing",
        version: "0.0.1",
        dependencies: {
          express: "^4.18.0"
        },
        private: true,
        keywords: ["spica", "function", "node.js"],
        license: "UNLICENSED",
        main: ".build/TestFuncDepFromRep/index.mjs"
      },
      null,
      2
    );

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      syncSub.unsubscribe();
      expect(sync).toEqual({
        _id: sync._id,
        status: SyncStatuses.PENDING,
        change_log: {
          _id: sync.change_log._id,
          module: "function",
          sub_module: "package",
          origin: ChangeOrigin.REPRESENTATIVE,
          type: ChangeType.CREATE,
          resource_id: null,
          resource_slug: name,
          resource_content: packageContent,
          resource_extension: fileExtension,
          created_at: sync.change_log.created_at,
          initiator: ChangeInitiator.EXTERNAL
        },
        created_at: sync.created_at,
        updated_at: sync.updated_at
      });
      done();
    });

    repManager.write("function", name, fileName, packageContent, fileExtension);
  });

  it("should sync dependency changes from representative to documents after approval", done => {
    const _id = new ObjectId();
    const name = "TestFuncDepRepApproved";
    const fileName = "package";
    const fileExtension = "json";
    const packageContent = JSON.stringify(
      {
        name,
        description: "A function for dependency testing",
        version: "0.0.1",
        dependencies: {
          lodash: "^4.17.21"
        },
        private: true,
        keywords: ["spica", "function", "node.js"],
        license: "UNLICENSED",
        main: `.build/${name}/index.mjs`
      },
      null,
      2
    );

    createTestFunction(_id, name).then(async () => {
      const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(async sync => {
        syncSub.unsubscribe();
        await syncProcessor.update(sync._id, SyncStatuses.APPROVED);
      });
      const succeededSub = syncProcessor.watch(SyncStatuses.SUCCEEDED).subscribe(async sync => {
        succeededSub.unsubscribe();
        const deps = await CRUD.dependencies.findOne(functionService, functionEngine, _id);
        expect(deps).toEqual([{name: "lodash", version: "^4.17.21", types: {}}]);
        done();
      });
      repManager.write("function", name, fileName, packageContent, fileExtension);
    });
  });
});
