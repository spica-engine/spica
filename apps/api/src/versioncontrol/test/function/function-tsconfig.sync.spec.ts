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
  getApplier as getFunctionTsconfigApplier,
  getSupplier as getFunctionTsconfigSupplier
} from "@spica-server/function/src/synchronizer/tsconfig";
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
import * as CRUD from "@spica-server/function/src/crud";
import fs from "fs";

describe("SyncEngine Integration - Function Tsconfig", () => {
  let module: TestingModule;
  let syncEngine: SyncEngine;
  let syncProcessor: SyncProcessor;
  let repManager: VCRepresentativeManager;

  let functionService: FunctionService;
  let functionEngine: FunctionEngine;

  const functionRoot = join(tmpdir(), "function_tsconfig_test_root");

  const createTestFunction = async (_id: ObjectId, name: string): Promise<Function> => {
    const testFunction: Function = {
      _id,
      name,
      description: "A TypeScript function for tsconfig testing",
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
      language: "typescript"
    };
    await CRUD.insert(functionService, functionEngine, testFunction);
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
      getFunctionTsconfigSupplier(functionEngine, functionService),
      getFunctionTsconfigApplier(functionService, functionEngine)
    );
  });

  afterEach(async () => {
    await module.close();
    if (fs.existsSync(functionRoot)) {
      await fs.promises.rm(functionRoot, {recursive: true, force: true});
    }
  });

  it("should push sync to processor when tsconfig.json changes", done => {
    const _id = new ObjectId();
    const name = "TestFuncTsconfig";
    const indexContent = `export function handler(req, res) { res.send("Hello"); }`;
    const expectedTsconfig = {
      compilerOptions: {
        moduleResolution: "Node10",
        module: "ES2022",
        target: "ES2022",
        typeRoots: ["./node_modules/@types"],
        sourceMap: true,
        alwaysStrict: true,
        preserveSymlinks: true,
        incremental: true,
        declaration: true,
        tsBuildInfoFile: "../.build/TestFuncTsconfig/.tsbuildinfo",
        baseUrl: ".",
        rootDir: ".",
        outDir: "../.build/TestFuncTsconfig"
      },
      include: ["index.ts"]
    };

    const subs = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      subs.unsubscribe();
      expect(new Date(sync.created_at)).toBeInstanceOf(Date);
      expect(sync.status).toBe(SyncStatuses.PENDING);
      expect(sync.change_log).toEqual({
        _id: sync.change_log._id,
        module: "function",
        sub_module: "tsconfig",
        origin: ChangeOrigin.DOCUMENT,
        type: ChangeType.CREATE,
        resource_id: _id.toString(),
        resource_slug: name,
        resource_content: JSON.stringify(expectedTsconfig, null, 2),
        resource_extension: "json",
        created_at: sync.change_log.created_at
      });
      done();
    });

    createTestFunction(_id, name).then(async fn => {
      await CRUD.index.write(functionService, functionEngine, fn._id, indexContent);
    });
  });

  it("should sync tsconfig changes from document to representatives", done => {
    const _id = new ObjectId();
    const name = "TestFuncTsconfigDocToRep";
    const indexContent = `export function handler(req, res) { res.send("Hello from Doc"); }`;
    const expectedTsconfig = {
      compilerOptions: {
        moduleResolution: "Node10",
        module: "ES2022",
        target: "ES2022",
        typeRoots: ["./node_modules/@types"],
        sourceMap: true,
        alwaysStrict: true,
        preserveSymlinks: true,
        incremental: true,
        declaration: true,
        tsBuildInfoFile: "../.build/TestFuncTsconfigDocToRep/.tsbuildinfo",
        baseUrl: ".",
        rootDir: ".",
        outDir: "../.build/TestFuncTsconfigDocToRep"
      },
      include: ["index.ts"]
    };

    const repSub = repManager
      .watch("function", ["tsconfig.json"], ["add", "change"])
      .subscribe(fileEvent => {
        repSub.unsubscribe();
        expect(JSON.parse(fileEvent.content)).toEqual(expectedTsconfig);
        done();
      });

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      syncSub.unsubscribe();
      syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    createTestFunction(_id, name).then(async fn => {
      await CRUD.index.write(functionService, functionEngine, fn._id, indexContent);
    });
  });

  it("should create pending sync when tsconfig.json changes come from representative", done => {
    const name = "TestFuncTsconfigFromRep";
    const fileName = "tsconfig";
    const fileExtension = "json";
    const tsconfigContent = JSON.stringify(
      {
        compilerOptions: {
          target: "ES2021",
          module: "ESNext",
          strict: true
        }
      },
      null,
      2
    );

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      syncSub.unsubscribe();
      expect(sync).toEqual({
        _id: sync._id,
        status: SyncStatuses.PENDING,
        created_at: sync.created_at,
        updated_at: sync.updated_at,
        change_log: {
          _id: sync.change_log._id,
          module: "function",
          sub_module: "tsconfig",
          origin: ChangeOrigin.REPRESENTATIVE,
          type: ChangeType.CREATE,
          created_at: sync.change_log.created_at,
          resource_content: tsconfigContent,
          resource_slug: name,
          resource_id: null,
          resource_extension: fileExtension
        }
      });
      done();
    });

    repManager.write("function", name, fileName, tsconfigContent, fileExtension);
  });

  fit("should fail to apply tsconfig changes from representative (read-only)", done => {
    const _id = new ObjectId();
    const name = "TestFuncTsconfigReadOnly";
    const fileName = "tsconfig";
    const fileExtension = "json";
    const tsconfigContent = JSON.stringify(
      {
        compilerOptions: {
          target: "ES2023",
          module: "ESNext",
          strict: true
        }
      },
      null,
      2
    );

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(async sync => {
      syncSub.unsubscribe();
      await syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    const failedSub = syncProcessor.watch(SyncStatuses.FAILED).subscribe(async sync => {
      failedSub.unsubscribe();
      expect(sync).toEqual({
        _id: sync._id,
        status: SyncStatuses.FAILED,
        created_at: sync.created_at,
        updated_at: sync.updated_at,
        reason: "tsconfig is read-only and changes cannot be applied.",
        change_log: {
          _id: sync.change_log._id,
          module: "function",
          sub_module: "tsconfig",
          origin: ChangeOrigin.REPRESENTATIVE,
          type: ChangeType.CREATE,
          created_at: sync.change_log.created_at,
          resource_content: tsconfigContent,
          resource_slug: name,
          resource_id: null,
          resource_extension: fileExtension
        }
      });
      done();
    });
    repManager.write("function", name, fileName, tsconfigContent, fileExtension);
  });
});
