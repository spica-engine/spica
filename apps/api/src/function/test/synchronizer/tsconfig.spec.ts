import {Test} from "@nestjs/testing";
import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {DatabaseService} from "@spica-server/database";
import {EnvVarService} from "@spica-server/env_var/services";
import {getSupplier, getApplier} from "../../src/synchronizer/tsconfig";
import * as CRUD from "../../src/crud";
import {
  ChangeInitiator,
  ChangeLog,
  ChangeOrigin,
  ChangeType
} from "@spica-server/interface/versioncontrol";
import {Function} from "@spica-server/interface/function";
import {rimraf} from "rimraf";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";

describe("Function tsconfig Synchronizer", () => {
  let functionService: FunctionService;
  let engine: FunctionEngine;
  let database: DatabaseService;
  let evs: EnvVarService;
  let scheduler: Scheduler;

  const compilerOptionsJson = {
    moduleResolution: "Node10",
    module: "ES2022",
    target: "ES2022",
    typeRoots: ["./node_modules/@types"],
    sourceMap: true,
    alwaysStrict: true,
    preserveSymlinks: true,
    incremental: true,
    declaration: true,
    baseUrl: ".",
    rootDir: "."
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
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
        DatabaseTestingModule.replicaSet()
      ]
    }).compile();

    database = module.get(DatabaseService);
    evs = new EnvVarService(database);
    functionService = new FunctionService(database, evs, {entryLimit: 100} as any);
    scheduler = module.get(Scheduler);

    engine = new FunctionEngine(
      functionService,
      database,
      scheduler,
      undefined,
      {
        root: "tsconfig_test",
        timeout: 60,
        outDir: ".build"
      },
      undefined,
      undefined
    );
  });

  afterEach(async () => {
    await functionService.deleteMany({});
    await rimraf("tsconfig_test");
  });

  describe("supplier", () => {
    let tsconfigSupplier;

    beforeEach(() => {
      tsconfigSupplier = getSupplier(engine, functionService);
    });

    it("should return ChangeSupplier with correct metadata", () => {
      expect(tsconfigSupplier).toEqual({
        module: "function",
        subModule: "tsconfig",
        listen: expect.any(Function)
      });
    });

    it("should emit ChangeLog for initial sync of existing TypeScript function", done => {
      const mockFunction: Function = {
        _id: new ObjectId(),
        name: "existing_ts_function",
        description: "Existing TypeScript function",
        language: "typescript",
        timeout: 60,
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "get",
              path: "/existing",
              preflight: true
            }
          }
        }
      };
      const index = `export function handler(req, res) { res.send("Hello World"); }`;

      CRUD.insert(functionService, engine, mockFunction).then(async fn => {
        await CRUD.index.write(functionService, engine, fn._id, index);

        const observable = tsconfigSupplier.listen();

        observable.subscribe((changeLog: ChangeLog) => {
          expect(changeLog).toEqual({
            module: "function",
            sub_module: "tsconfig",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: mockFunction._id.toString(),
            resource_slug: mockFunction.name,
            resource_content: changeLog.resource_content,
            resource_extension: "json",
            created_at: expect.any(Date),
            initiator: ChangeInitiator.INTERNAL
          });
          done();
        });
      });
    });

    it("should emit ChangeLog for CREATE when new TypeScript function is created after listening", done => {
      const mockFunction: Function = {
        _id: new ObjectId(),
        name: "new_ts_function",
        description: "New TypeScript function created after listener starts",
        language: "typescript",
        timeout: 60,
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "post",
              path: "/new",
              preflight: true
            }
          }
        }
      };
      const index = `export function handler(req, res) { res.send("Hello World"); }`;

      const observable = tsconfigSupplier.listen();

      observable.subscribe(async (changeLog: ChangeLog) => {
        expect(changeLog).toEqual({
          module: "function",
          sub_module: "tsconfig",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: mockFunction._id.toString(),
          resource_slug: mockFunction.name,
          resource_content: changeLog.resource_content,
          resource_extension: "json",
          created_at: expect.any(Date),
          initiator: ChangeInitiator.EXTERNAL
        });
        done();
      });

      CRUD.insert(functionService, engine, mockFunction).then(async fn => {
        await CRUD.index.write(functionService, engine, fn._id, index);
      });
    });

    it("should emit ChangeLog when function tsconfig is deleted", done => {
      const mockFunction: Function = {
        _id: new ObjectId(),
        name: "test_delete_function",
        description: "Test delete function",
        language: "typescript",
        timeout: 60,
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "delete",
              path: "/test-delete",
              preflight: true
            }
          }
        }
      };
      const index = `export function handler(req, res) { res.send("Hello World"); }`;
      CRUD.insert(functionService, engine, mockFunction).then(async fn => {
        await CRUD.index.write(functionService, engine, fn._id, index);

        const observable = tsconfigSupplier.listen();

        observable.subscribe(async (changeLog: ChangeLog) => {
          if (changeLog.type === ChangeType.CREATE) {
            await engine.deleteFunction(fn);
            return;
          }

          if (changeLog.type === ChangeType.DELETE) {
            expect(changeLog).toEqual({
              module: "function",
              sub_module: "tsconfig",
              type: ChangeType.DELETE,
              origin: ChangeOrigin.DOCUMENT,
              resource_id: mockFunction._id.toString(),
              resource_content: null,
              resource_extension: "json",
              resource_slug: mockFunction.name,
              created_at: expect.any(Date),
              initiator: ChangeInitiator.EXTERNAL
            });
            done();
          }
        });
      });
    });
  });

  describe("applier", () => {
    let tsconfigApplier;

    beforeEach(() => {
      tsconfigApplier = getApplier(functionService, engine);
    });

    it("should return DocumentChangeApplier with correct metadata", () => {
      expect(tsconfigApplier).toEqual({
        module: "function",
        subModule: "tsconfig",
        fileExtensions: ["json"],
        findIdBySlug: expect.any(Function),
        findIdByContent: expect.any(Function),
        apply: expect.any(Function)
      });
    });

    it("should not apply any changes and return FAILED status", async () => {
      const mockFunction: Function = {
        _id: new ObjectId(),
        name: "test_function",
        description: "Test delete function",
        language: "typescript",
        timeout: 60,
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "get",
              path: "/test",
              preflight: true
            }
          }
        }
      };
      const index = `export function handler(req, res) { res.send("Hello World"); }`;
      CRUD.insert(functionService, engine, mockFunction).then(async fn => {
        await CRUD.index.write(functionService, engine, fn._id, index);
      });

      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "tsconfig",
        origin: ChangeOrigin.DOCUMENT,
        type: ChangeType.CREATE,
        resource_id: mockFunction._id.toString(),
        resource_slug: mockFunction.name,
        resource_content: JSON.stringify({
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
            baseUrl: ".",
            rootDir: "."
          }
        }),
        resource_extension: "json",
        created_at: new Date(),
        initiator: ChangeInitiator.EXTERNAL
      };

      const result = await tsconfigApplier.apply(changeLog);
      expect(result).toEqual({
        status: "FAILED",
        reason: `tsconfig is read-only and changes cannot be applied.`
      });
    });
  });
});
