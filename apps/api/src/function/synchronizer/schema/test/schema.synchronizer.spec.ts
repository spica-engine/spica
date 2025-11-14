import {Test, TestingModule} from "@nestjs/testing";
import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {LogService} from "@spica-server/function/log";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {EnvVarService} from "@spica-server/env_var/services";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";
import {applier, supplier} from "../src";
import {
  ChangeLog,
  ChangeOrigin,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import YAML from "yaml";
import {deepCopy} from "@spica-server/core/patch";
import {skip, firstValueFrom} from "rxjs";
import * as rimraf from "rimraf";

describe("Function Synchronizer", () => {
  let module: TestingModule;
  let fs: FunctionService;
  let engine: FunctionEngine;
  let logs: LogService;
  let database: DatabaseService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
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
        })
      ]
    }).compile();

    database = module.get(DatabaseService);
    const evs = new EnvVarService(database);
    const scheduler = module.get(Scheduler);

    fs = new FunctionService(database, evs, {entryLimit: 20} as any);
    logs = new LogService(database, {expireAfterSeconds: 60 * 60 * 24 * 7, realtime: false});

    engine = new FunctionEngine(
      fs,
      database,
      scheduler,
      undefined,
      {
        root: "test_root",
        timeout: 60,
        outDir: ".build"
      },
      undefined,
      undefined
    );
  });

  afterEach(async () => {
    rimraf.sync("test_root");
    await module.close();
  });

  describe("functionfuncSupplier", () => {
    let funcSupplier;

    beforeEach(() => {
      funcSupplier = supplier(fs);
    });

    it("should return Change supplier with correct metadata", () => {
      expect(funcSupplier).toMatchObject({
        module: "function",
        subModule: "schema",
        fileExtension: "yaml",
        listen: expect.any(Function)
      });
    });

    it("should emit ChangeLog on initial start", async () => {
      const mockFunction: any = {
        _id: new ObjectId(),
        name: "test_function",
        description: "Test function description",
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
      await fs.insertOne(mockFunction);

      const changeLog = await firstValueFrom(funcSupplier.listen());

      expect(changeLog).toMatchObject({
        module: "function",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.DOCUMENT,
        resource_id: mockFunction._id.toString(),
        resource_slug: "test_function",
        resource_content: YAML.stringify(mockFunction),
        created_at: expect.any(Date)
      });
    });

    it("should emit ChangeLog on function insert", done => {
      const mockFunction: any = {
        _id: new ObjectId(),
        name: "test_function",
        description: "Test function description",
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

      const observable = funcSupplier.listen();

      observable.subscribe(changeLog => {
        expect(changeLog).toMatchObject({
          module: "function",
          sub_module: "schema",
          type: ChangeType.CREATE,
          origin: ChangeOrigin.DOCUMENT,
          resource_id: mockFunction._id.toString(),
          resource_slug: "test_function",
          resource_content: YAML.stringify(mockFunction),
          created_at: expect.any(Date)
        });

        done();
      });

      fs.insertOne(mockFunction);
    });

    it("should emit ChangeLog on function update", done => {
      const functionId = new ObjectId();
      const initialFunction: any = {
        _id: functionId,
        name: "initial_function",
        description: "Initial description",
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/initial"
            }
          }
        },
        timeout: 60,
        language: "javascript"
      };

      let updatedFunction: any = {
        _id: functionId,
        name: "updated_function",
        description: "Updated description",
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Post",
              path: "/updated"
            }
          }
        },
        timeout: 120,
        language: "javascript"
      };
      const expectedUpdatedFunction = deepCopy(updatedFunction);

      const observable = funcSupplier.listen().pipe(skip(1));

      observable.subscribe(changeLog => {
        if (changeLog.type === ChangeType.UPDATE) {
          expect(changeLog).toMatchObject({
            module: "function",
            sub_module: "schema",
            type: ChangeType.UPDATE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: functionId.toString(),
            resource_slug: "updated_function",
            resource_content: YAML.stringify(expectedUpdatedFunction),
            created_at: expect.any(Date)
          });
          done();
        }
      });

      (async () => {
        await fs.insertOne(initialFunction);
        const {_id, language, ...updateFields} = updatedFunction;
        await fs.findOneAndUpdate({_id: functionId}, {$set: updateFields});
      })().catch(err => done(err));
    });

    it("should emit ChangeLog on function delete", done => {
      const functionId = new ObjectId();
      const functionToDelete: any = {
        _id: functionId,
        name: "function_to_delete",
        description: "Will be deleted",
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/delete"
            }
          }
        },
        timeout: 60,
        language: "javascript"
      };

      const observable = funcSupplier.listen().pipe(skip(1));

      observable.subscribe(changeLog => {
        if (changeLog.type === ChangeType.DELETE) {
          expect(changeLog).toMatchObject({
            module: "function",
            sub_module: "schema",
            type: ChangeType.DELETE,
            origin: ChangeOrigin.DOCUMENT,
            resource_id: functionId.toString(),
            resource_slug: null,
            resource_content: "",
            created_at: expect.any(Date)
          });

          done();
        }
      });

      (async () => {
        await fs.insertOne(functionToDelete);
        await fs.findOneAndDelete({_id: functionId});
      })().catch(err => done(err));
    });
  });

  describe("functionApplier", () => {
    let funcApplier;

    beforeEach(() => {
      funcApplier = applier(fs, engine, logs);
    });

    it("should return Change Applier with correct metadata", () => {
      expect(funcApplier).toMatchObject({
        module: "function",
        subModule: "schema",
        fileExtension: "yaml",
        apply: expect.any(Function)
      });
    });

    it("should apply insert change successfully", async () => {
      const _id = new ObjectId();
      const mockFunction: any = {
        _id,
        name: "new_function",
        description: "New function",
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/new"
            }
          }
        },
        timeout: 60,
        language: "javascript"
      };

      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: mockFunction._id.toString(),
        resource_slug: "new_function",
        resource_content: YAML.stringify(mockFunction),
        created_at: new Date(),
        resource_extension: "yaml"
      };

      const result = await funcApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const insertedFunction = await fs.findOne({_id: mockFunction._id});
      expect(insertedFunction).toMatchObject({
        _id,
        name: "new_function",
        description: "New function",
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/new"
            }
          }
        },
        timeout: 60,
        language: "javascript"
      });
    });

    it("should apply update change successfully", async () => {
      const _id = new ObjectId();
      const existingFunction: any = {
        _id,
        name: "old_function",
        description: "Old description",
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/old"
            }
          }
        },
        timeout: 60,
        language: "javascript"
      };

      await fs.insertOne(existingFunction);

      const updatedFunction: any = {
        _id,
        name: "updated_function",
        description: "Updated description",
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Post",
              path: "/updated"
            }
          },
          schedule: {
            type: "schedule",
            active: true,
            options: {
              cron: "0 0 * * *",
              timezone: "UTC"
            }
          }
        },
        timeout: 120,
        language: "javascript"
      };

      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "schema",
        type: ChangeType.UPDATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: "updated_function",
        resource_content: YAML.stringify(updatedFunction),
        created_at: new Date(),
        resource_extension: "yaml"
      };

      const result = await funcApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const fn = await fs.findOne({_id});
      expect(fn).toMatchObject({
        name: "updated_function",
        description: "Updated description",
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Post",
              path: "/updated"
            }
          },
          schedule: {
            type: "schedule",
            active: true,
            options: {
              cron: "0 0 * * *",
              timezone: "UTC"
            }
          }
        },
        timeout: 120
      });
    });

    it("should apply delete change successfully", async () => {
      const _id = new ObjectId();
      const mockFunction: any = {
        _id,
        name: "function_to_delete",
        description: "To be deleted",
        env_vars: [],
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/delete"
            }
          }
        },
        timeout: 60,
        language: "javascript"
      };

      await fs.insertOne(mockFunction);

      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "schema",
        type: ChangeType.DELETE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: _id.toString(),
        resource_slug: null,
        resource_content: "",
        created_at: new Date(),
        resource_extension: "yaml"
      };

      const result = await funcApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.SUCCEEDED
      });

      const fn = await fs.findOne({_id});
      expect(fn).toBeNull();
    });

    it("should handle unknown operation type", async () => {
      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "schema",
        type: "upsert" as any,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: null,
        resource_content: "",
        created_at: new Date(),
        resource_extension: "yaml"
      };

      const result = await funcApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED,
        reason: "Unknown operation type: upsert"
      });
    });

    it("should handle YAML parse errors", async () => {
      const changeLog: ChangeLog = {
        module: "function",
        sub_module: "schema",
        type: ChangeType.CREATE,
        origin: ChangeOrigin.REPRESENTATIVE,
        resource_id: "123",
        resource_slug: "test_function",
        resource_content: "invalid: yaml: content:",
        created_at: new Date(),
        resource_extension: "yaml"
      };

      const result = await funcApplier.apply(changeLog);

      expect(result).toMatchObject({
        status: SyncStatuses.FAILED
      });
      expect(result.reason).toBeDefined();
    });
  });
});
