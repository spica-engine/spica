import {Test} from "@nestjs/testing";
import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {DatabaseService} from "@spica-server/database";
import {EnvVarService} from "@spica-server/env_var/services";
import {supplier} from "../src/supplier";
import {applier} from "../src/applier";
import * as CRUD from "../../../src/crud";
import {
  ChangeLog,
  ChangeOrigin,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import {Function} from "@spica-server/interface/function";
import {rimraf} from "rimraf";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";

describe("Function Index Synchronizer", () => {
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
        root: "index_test",
        timeout: 60,
        outDir: ".build"
      },
      undefined,
      undefined
    );
  });

  afterEach(async () => {
    await functionService.deleteMany({});
    await rimraf("index_test");
  });

  describe("supplier", () => {
    let indexSupplier;

    beforeEach(() => {
      indexSupplier = supplier(engine, functionService);
    });

    it("should return ChangeSupplier with correct metadata", () => {
      expect(indexSupplier).toMatchObject({
        module: "function",
        subModule: "index",
        fileExtension: "js",
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

      const indexContent = `export default function(req, res) {
        res.send("Existing function");
        }`;
      const observable = indexSupplier.listen();

      observable.subscribe((changeLog: ChangeLog) => {
        expect(changeLog).toMatchObject({
          module: "function",
          sub_module: "index",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: mockFunction._id.toString(),
          resource_slug: mockFunction.name,
          resource_content: indexContent,
          created_at: expect.any(Date)
        });
        done();
      });

      CRUD.insert(functionService, engine, mockFunction).then(async fn => {
        await engine.update(fn, indexContent);
      });
    });

    it("should emit ChangeLog when function index is updated with new content", done => {
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

      const indexContent = `export default function(req, res) {
        res.send("Hello from JS");
        }`;

      const updatedContent = `export default function(req, res) {
        res.send("Updated");
        }`;

      CRUD.insert(functionService, engine, mockFunction).then(async fn => {
        await engine.update(fn, indexContent);
        const observable = indexSupplier.listen();
        observable.subscribe(async (changeLog: ChangeLog) => {
          if (changeLog.type === ChangeType.CREATE) {
            await engine.update(fn, updatedContent);
            return;
          }
          expect(changeLog).toMatchObject({
            module: "function",
            sub_module: "index",
            type: ChangeType.UPDATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: mockFunction._id.toString(),
            resource_slug: mockFunction.name,
            resource_content: updatedContent,
            created_at: expect.any(Date)
          });
          done();
        });
      });
    });

    it("should emit ChangeLog when function index is cleared (deleted)", done => {
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

      const indexContent = `export default function(req, res) {
        res.send("To be deleted");
        }`;

      CRUD.insert(functionService, engine, mockFunction).then(async fn => {
        await engine.update(fn, indexContent);
        const observable = indexSupplier.listen();

        observable.subscribe(async (changeLog: ChangeLog) => {
          if (changeLog.type === ChangeType.CREATE) {
            await engine.deleteFunction(fn);
            return;
          }
          expect(changeLog).toMatchObject({
            module: "function",
            sub_module: "index",
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
    let indexApplier;

    beforeEach(() => {
      indexApplier = applier(functionService, engine);
    });

    it("should return ChangeApplier with correct metadata", () => {
      expect(indexApplier).toMatchObject({
        module: "function",
        subModule: "index",
        fileExtension: "js",
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

      const indexContent = `export default function(req, res) {
        res.status(201).send({message: "Created"});
        }`;

      await CRUD.insert(functionService, engine, mockFunction);

      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "index",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: mockFunction._id.toString(),
        resource_slug: mockFunction.name,
        resource_content: indexContent,
        created_at: new Date(),
        resource_extension: "js"
      };

      const result = await indexApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });
      const savedIndex = await engine.read(mockFunction, "index");
      expect(savedIndex).toContain("Created");
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

      const initialIndex = `export default function(req, res) {
        res.send("Initial");
        }`;

      await engine.update(mockFunction, initialIndex);

      const updatedIndex = `export default function(req, res) {
        res.send("Updated");
        }`;

      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "index",
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: mockFunction._id.toString(),
        resource_slug: mockFunction.name,
        resource_content: updatedIndex,
        created_at: new Date(),
        resource_extension: "js"
      };

      const result = await indexApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const savedIndex = await engine.read(mockFunction, "index");
      expect(savedIndex).toContain("Updated");
      expect(savedIndex).not.toContain("Initial");
    });

    fit("should handle delete change by clearing index file", async () => {
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

      const initialContent = `export default function(req, res) {
        res.send("To be deleted");
        }`;
      await engine.update(mockFunction, initialContent);

      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "index",
        type: ChangeType.DELETE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: mockFunction._id.toString(),
        resource_slug: mockFunction.name,
        resource_content: null,
        created_at: new Date(),
        resource_extension: "js"
      };

      const result = await indexApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });
      let savedIndex;
      try {
        savedIndex = await engine.read(mockFunction, "index");
      } catch (err) {
        if (err === "Not Found") {
          savedIndex = undefined;
        } else {
          throw err;
        }
      }
      expect(savedIndex).toBe(undefined);
    });

    it("should handle unknown operation type", async () => {
      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "index",
        type: "upsert" as any,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: "test",
        resource_content: "some content",
        created_at: new Date(),
        resource_extension: "js"
      };

      const result = await indexApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED,
        reason: "Unknown operation type: upsert"
      });
    });

    it("should handle errors when function not found", async () => {
      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "index",
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: new ObjectId().toString(),
        resource_slug: "nonexistent_function",
        resource_content: "export default function() {}",
        created_at: new Date(),
        resource_extension: "js"
      };

      const result = await indexApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED
      });
      expect(result.reason).toBeDefined();
    });

    it("should handle invalid function ID", async () => {
      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "index",
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "invalid-id",
        resource_slug: "test_function",
        resource_content: "export default function() {}",
        created_at: new Date(),
        resource_extension: "js"
      };

      const result = await indexApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED
      });
      expect(result.reason).toBeDefined();
    });
  });
});
