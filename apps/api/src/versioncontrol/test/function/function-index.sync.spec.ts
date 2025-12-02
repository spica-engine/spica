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
  getApplier as getFunctionIndexApplier,
  getSupplier as getFunctionIndexSupplier
} from "@spica-server/function/src/synchronizer/index";
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

describe("SyncEngine Integration - Function Index", () => {
  let module: TestingModule;
  let syncEngine: SyncEngine;
  let syncProcessor: SyncProcessor;
  let repManager: VCRepresentativeManager;

  let functionService: FunctionService;
  let functionEngine: FunctionEngine;

  const functionRoot = join(tmpdir(), "function_index_test_root");

  const createTestFunction = async (_id: ObjectId, name: string): Promise<Function> => {
    const testFunction: Function = {
      _id,
      name,
      description: "A function for index testing",
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
      getFunctionIndexSupplier(functionEngine, functionService),
      getFunctionIndexApplier(functionService, functionEngine)
    );
  });

  afterEach(async () => {
    await module.close();
    if (fs.existsSync(functionRoot)) {
      await fs.promises.rm(functionRoot, {recursive: true, force: true});
    }
  });

  it("should push sync to processor when index file changes", done => {
    const _id = new ObjectId();
    const name = "TestFuncIndex";
    const indexContent = `export function handler(req, res) { res.send("Hello"); }`;

    createTestFunction(_id, name).then(async fn => {
      const subs = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
        subs.unsubscribe();

        expect(new Date(sync.created_at)).toBeInstanceOf(Date);
        expect(sync.status).toBe(SyncStatuses.PENDING);
        expect(sync.change_log).toEqual({
          _id: sync.change_log._id,
          module: "function",
          sub_module: "index",
          origin: ChangeOrigin.DOCUMENT,
          type: ChangeType.CREATE,
          resource_id: _id.toString(),
          resource_slug: name,
          resource_content: indexContent,
          resource_extension: "js",
          created_at: sync.change_log.created_at
        });
        done();
      });

      await CRUD.index.write(functionService, functionEngine, fn._id, indexContent);
    });
  });

  it("should sync index changes from document to representatives", done => {
    const _id = new ObjectId();
    const name = "TestFuncIndexDocToRep";
    const indexContent = `export function handler(req, res) { res.send("Hello from Doc"); }`;

    createTestFunction(_id, name).then(async fn => {
      const repSub = repManager
        .watch("function", ["index.js"], ["add", "change"])
        .subscribe(fileEvent => {
          repSub.unsubscribe();
          expect(fileEvent.content).toContain("Hello from Doc");
          done();
        });

      const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
        syncSub.unsubscribe();
        syncProcessor.update(sync._id, SyncStatuses.APPROVED);
      });

      await CRUD.index.write(functionService, functionEngine, fn._id, indexContent);
    });
  });

  it("should create pending sync when index changes come from representative", done => {
    const _id = new ObjectId();
    const name = "TestFuncIndexFromRep";
    const fileName = "index";
    const fileExtension = "mjs";
    const indexContent = `export function handler(req, res) { res.send("Hello from Rep"); }`;

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(sync => {
      expect(sync.status).toBe(SyncStatuses.PENDING);
      expect(sync.change_log).toEqual({
        _id: sync.change_log._id,
        module: "function",
        sub_module: "index",
        origin: ChangeOrigin.REPRESENTATIVE,
        type: ChangeType.CREATE,
        resource_id: _id.toString(),
        resource_slug: name,
        resource_content: indexContent,
        resource_extension: "mjs",
        created_at: sync.change_log.created_at
      });
      syncSub.unsubscribe();
      done();
    });

    repManager.write("function", name, fileName, indexContent, fileExtension);
  });

  it("should sync index changes from representative to documents after approval", done => {
    const _id = new ObjectId();
    const name = "TestFuncIndexRepApproved";
    const fileName = "index";
    const fileExtension = "mjs";
    const indexContent = `export function handler(req, res) { res.send("Hello from Rep Approved"); }`;

    const syncSub = syncProcessor.watch(SyncStatuses.PENDING).subscribe(async sync => {
      syncSub.unsubscribe();
      await syncProcessor.update(sync._id, SyncStatuses.APPROVED);
    });

    const succeededSub = syncProcessor.watch(SyncStatuses.SUCCEEDED).subscribe(async sync => {
      succeededSub.unsubscribe();

      const fn = await functionService.findOne({_id});
      const indexPath = join(functionRoot, fn.name, "index.mjs");
      const writtenContent = await fs.promises.readFile(indexPath, "utf-8");
      expect(writtenContent).toContain("Hello from Rep Approved");
      done();
    });

    repManager.write("function", name, fileName, indexContent, fileExtension);
  });
});
