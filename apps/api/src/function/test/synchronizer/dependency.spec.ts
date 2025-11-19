import {Test} from "@nestjs/testing";
import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {DatabaseService} from "@spica-server/database";
import {EnvVarService} from "@spica-server/env_var/services";
import {getSupplier, getApplier} from "../../src/synchronizer/dependency";
import * as CRUD from "../../src/crud";
import {
  ChangeLog,
  ChangeOrigin,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import {Function} from "@spica-server/interface/function";
import {rimraf} from "rimraf";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";

describe("Function Dependency Synchronizer", () => {
  let functionService: FunctionService;
  let engine: FunctionEngine;
  let database: DatabaseService;
  let evs: EnvVarService;
  let scheduler: Scheduler;

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
        root: "dependency_test",
        timeout: 60,
        outDir: ".build"
      },
      undefined,
      undefined
    );
  });

  afterEach(async () => {
    await functionService.deleteMany({});
    await rimraf("dependency_test");
  });

  describe("supplier", () => {
    let dependencySupplier;

    beforeEach(() => {
      dependencySupplier = getSupplier(engine, functionService);
    });

    it("should return ChangeSupplier with correct metadata", () => {
      expect(dependencySupplier).toMatchObject({
        module: "function",
        subModule: "package",
        fileExtension: "json",
        listen: expect.any(Function)
      });
    });

    it("should emit ChangeLog for CREATE when function exists initially", done => {
      const mockFunction: Function = {
        _id: new ObjectId(),
        name: "existing_function",
        description: "Existing function",
        language: "javascript",
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

      CRUD.insert(functionService, engine, mockFunction).then(async fn => {
        const fnWithDeps = {...fn, dependencies: {axios: "^1.0.0"}};
        await CRUD.dependencies.update(engine, fnWithDeps);

        const observable = dependencySupplier.listen();

        observable.subscribe((changeLog: ChangeLog) => {
          expect(changeLog).toMatchObject({
            module: "function",
            sub_module: "package",
            type: ChangeType.CREATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: mockFunction._id.toString(),
            resource_slug: mockFunction.name,
            created_at: expect.any(Date)
          });
          const packageJson = JSON.parse(changeLog.resource_content);
          expect(packageJson).toMatchObject({
            name: "existing_function",
            description: "Existing function",
            version: "0.0.1",
            private: true,
            keywords: ["spica", "function", "node.js"],
            license: "UNLICENSED",
            dependencies: {axios: "^1.0.0"}
          });
          done();
        });
      });
    });

    it("should emit ChangeLog when function dependency is updated with new content", done => {
      const mockFunction: Function = {
        _id: new ObjectId(),
        name: "test_js_function",
        description: "Test JS function",
        language: "javascript",
        timeout: 60,
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "get",
              path: "/test-js",
              preflight: true
            }
          }
        }
      };

      CRUD.insert(functionService, engine, mockFunction).then(async fn => {
        const fnWithDeps = {...fn, dependencies: {axios: "^1.0.0"}};
        await CRUD.dependencies.update(engine, fnWithDeps);

        const observable = dependencySupplier.listen();
        observable.subscribe(async (changeLog: ChangeLog) => {
          if (changeLog.type === ChangeType.CREATE) {
            const fnWithUpdatedDeps = {...fn, dependencies: {axios: "^1.0.0", lodash: "^4.17.21"}};
            await CRUD.dependencies.update(engine, fnWithUpdatedDeps);
            return;
          }
          expect(changeLog).toMatchObject({
            module: "function",
            sub_module: "package",
            type: ChangeType.UPDATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: mockFunction._id.toString(),
            resource_slug: mockFunction.name,
            created_at: expect.any(Date)
          });
          const packageJson = JSON.parse(changeLog.resource_content);
          expect(packageJson).toMatchObject({
            name: "test_js_function",
            dependencies: {axios: "^1.0.0", lodash: "^4.17.21"}
          });
          done();
        });
      });
    });

    it("should emit ChangeLog when function dependency is cleared (deleted)", done => {
      const mockFunction: Function = {
        _id: new ObjectId(),
        name: "test_delete_function",
        description: "Test delete function",
        language: "javascript",
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

      CRUD.insert(functionService, engine, mockFunction).then(async fn => {
        const fnWithDeps = {...fn, dependencies: {}};
        await CRUD.dependencies.update(engine, fnWithDeps);

        const observable = dependencySupplier.listen();

        observable.subscribe(async (changeLog: ChangeLog) => {
          if (changeLog.type === ChangeType.CREATE) {
            const deleted = await engine.deleteFunction(fn);
            return;
          }
          expect(changeLog).toMatchObject({
            module: "function",
            sub_module: "package",
            type: ChangeType.DELETE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: mockFunction._id.toString(),
            resource_slug: mockFunction.name,
            resource_content: null,
            created_at: expect.any(Date)
          });
          done();
        });
      });
    });
  });

  describe("applier", () => {
    let dependencyApplier;

    beforeEach(() => {
      dependencyApplier = getApplier(functionService, engine);
    });

    it("should return ChangeApplier with correct metadata", () => {
      expect(dependencyApplier).toMatchObject({
        module: "function",
        subModule: "package",
        fileExtension: "json",
        apply: expect.any(Function)
      });
    });

    it("should apply create change successfully", async () => {
      const mockFunction: Function = {
        _id: new ObjectId(),
        name: "new_function",
        description: "New function",
        language: "javascript",
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

      const packageContent = JSON.stringify({
        name: "new_function",
        version: "1.0.0",
        dependencies: {
          express: "^4.18.0"
        }
      });

      await CRUD.insert(functionService, engine, mockFunction);

      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "package",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: mockFunction._id.toString(),
        resource_slug: mockFunction.name,
        resource_content: packageContent,
        created_at: new Date(),
        resource_extension: "json"
      };

      const result = await dependencyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });
      const packages = await CRUD.dependencies.findOne(functionService, engine, mockFunction._id);
      expect(packages.some(p => p.name === "express")).toBe(true);
    });

    it("should apply update change successfully", async () => {
      const mockFunction: Function = {
        _id: new ObjectId(),
        name: "update_function",
        description: "Function to update",
        language: "javascript",
        timeout: 60,
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "get",
              path: "/update",
              preflight: true
            }
          }
        }
      };

      await CRUD.insert(functionService, engine, mockFunction);

      const fnWithInitialDeps = {...mockFunction, dependencies: {axios: "^1.0.0"}};
      await CRUD.dependencies.update(engine, fnWithInitialDeps);

      const updatedPackage = JSON.stringify({
        name: "update_function",
        version: "2.0.0",
        dependencies: {
          axios: "^1.5.0",
          lodash: "^4.17.21"
        }
      });

      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "package",
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: mockFunction._id.toString(),
        resource_slug: mockFunction.name,
        resource_content: updatedPackage,
        created_at: new Date(),
        resource_extension: "json"
      };

      const result = await dependencyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const packages = await CRUD.dependencies.findOne(functionService, engine, mockFunction._id);
      expect(packages.some(p => p.name === "lodash")).toBe(true);
      expect(packages.some(p => p.name === "axios")).toBe(true);
    });

    it("should handle delete change by clearing package file", async () => {
      const mockFunction: Function = {
        _id: new ObjectId(),
        name: "delete_function",
        description: "Function to delete",
        language: "javascript",
        timeout: 60,
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "post",
              path: "/delete",
              preflight: true
            }
          }
        }
      };

      await CRUD.insert(functionService, engine, mockFunction);

      const fnWithDeps = {...mockFunction, dependencies: {}};

      await CRUD.dependencies.update(engine, fnWithDeps);

      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "package",
        type: ChangeType.DELETE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: mockFunction._id.toString(),
        resource_slug: mockFunction.name,
        resource_content: null,
        created_at: new Date(),
        resource_extension: "json"
      };

      const result = await dependencyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });
      let savedPackage;
      try {
        savedPackage = await engine.read(mockFunction, "dependency");
      } catch (err) {
        if (err === "Not Found") {
          savedPackage = undefined;
        } else {
          throw err;
        }
      }
      expect(savedPackage).toBe(undefined);
    });

    it("should handle unknown operation type", async () => {
      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "package",
        type: "upsert" as any,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: "test",
        resource_content: "some content",
        created_at: new Date(),
        resource_extension: "json"
      };

      const result = await dependencyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED,
        reason: "Unknown operation type: upsert"
      });
    });

    it("should handle errors when function not found", async () => {
      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "package",
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: new ObjectId().toString(),
        resource_slug: "nonexistent_function",
        resource_content: JSON.stringify({name: "test", version: "1.0.0"}),
        created_at: new Date(),
        resource_extension: "json"
      };

      const result = await dependencyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED
      });
      expect(result.reason).toBeDefined();
    });

    it("should handle invalid function ID", async () => {
      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "package",
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "invalid-id",
        resource_slug: "test_function",
        resource_content: JSON.stringify({name: "test", version: "1.0.0"}),
        created_at: new Date(),
        resource_extension: "json"
      };

      const result = await dependencyApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED
      });
      expect(result.reason).toBeDefined();
    });
  });
});
