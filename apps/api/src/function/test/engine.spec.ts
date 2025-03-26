import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {FunctionService} from "@spica-server/function/services";
import {INestApplication} from "@nestjs/common";
import {TargetChange, ChangeKind} from "@spica-server/function/src/change";
import {EnvVarsService} from "@spica-server/env_var/services";
process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:4378";

describe("Engine", () => {
  let engine: FunctionEngine;
  let subscribeSpy: jest.SpyInstance;
  let unsubscribeSpy: jest.SpyInstance;

  let scheduler: Scheduler;
  let database: DatabaseService;
  let fs: FunctionService;
  let evs: EnvVarsService;

  let module: TestingModule;
  let app: INestApplication;

  const hexString = "507f1f77bcf86cd799439011";

  beforeEach(async () => {
    module = await Test.createTestingModule({
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

    app = module.createNestApplication();

    scheduler = module.get(Scheduler);
    database = module.get(DatabaseService);

    evs = new EnvVarsService(database);
    fs = new FunctionService(database, evs, {} as any);
    engine = new FunctionEngine(
      fs,
      database,
      scheduler,
      undefined,
      {
        root: "test_root",
        timeout: 1,
        outDir: ".build"
      },
      undefined,
      undefined
    );

    await app.init();

    subscribeSpy = jest.spyOn(engine, "subscribe" as any).mockReturnValue(undefined);
    unsubscribeSpy = jest.spyOn(engine, "unsubscribe" as any).mockReturnValue(undefined);
  });

  afterEach(async () => {
    subscribeSpy.mockReset();
    unsubscribeSpy.mockReset();
    await module.close();
    return app.close();
  });

  it("should subscribe to new trigger if ChangeKind is Added", () => {
    let changes: TargetChange = {
      kind: ChangeKind.Added,
      target: {
        id: "test_id",
        handler: "test_handler"
      }
    };

    engine["categorizeChanges"]([changes]);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(changes);
    expect(unsubscribeSpy).not.toHaveBeenCalled();
  });

  it("should unsubscribe from removed trigger if ChangeKind is Removed", () => {
    let changes: TargetChange = {
      kind: ChangeKind.Removed,
      target: {
        id: "test_id",
        handler: "test_handler"
      }
    };

    engine["categorizeChanges"]([changes]);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(changes);

    expect(subscribeSpy).toHaveBeenCalledTimes(0);
  });

  it("should call unsubscribe for once then call subscribe if ChangeKind is Updated", () => {
    let changes: TargetChange[] = [
      {
        kind: ChangeKind.Updated,
        target: {
          id: "test_id",
          handler: "test_handler"
        }
      }
    ];

    engine["categorizeChanges"](changes);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(changes[0]);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(changes[0]);
  });

  it("should set the handler when a handler is disabled", () => {
    let changes: TargetChange[] = [
      {
        kind: ChangeKind.Updated,
        target: {
          id: "test_id",
          handler: "test_handler"
        }
      },
      {
        kind: ChangeKind.Removed,
        target: {
          id: "test_id",
          handler: "test_handler2"
        }
      }
    ];
    engine["categorizeChanges"](changes);
    expect(unsubscribeSpy).toHaveBeenCalledWith(changes[1]);
  });

  it("should create the scheduling context when subscribing", () => {
    const changes: TargetChange = {
      kind: ChangeKind.Added,
      target: {
        id: "test_id",
        handler: "test_handler",
        context: {
          env: {
            TEST: "true"
          },
          timeout: 60
        }
      },
      type: "http",
      options: {
        method: "POST",
        path: "/test"
      }
    };

    const httpEnqueuer = Array.from(scheduler.enqueuers).find(
      enqueuer => enqueuer.description.name == "http"
    );
    const httpSubscribe = jest.spyOn(httpEnqueuer, "subscribe");
    subscribeSpy.mockRestore();
    engine["categorizeChanges"]([changes]);
    expect(httpSubscribe.mock.calls[httpSubscribe.mock.calls.length - 1][0].toObject()).toEqual({
      id: "test_id",
      cwd: "test_root/test_id",
      handler: "test_handler",
      context: {
        env: [{key: "TEST", value: "true"}],
        timeout: 60
      }
    });
  });

  it("should unregister triggers on module destroy", async () => {
    await fs.insertOne({
      _id: new ObjectId(hexString),
      env_vars: [],
      language: "js",
      timeout: 10,
      name: "my_fn",
      triggers: {test_handler: {active: true, options: {}, type: "http"}}
    });

    let changes: TargetChange[] = [
      {
        kind: ChangeKind.Added,
        target: {
          id: hexString,
          handler: "test_handler",
          context: {
            env: {},
            timeout: 10
          }
        },
        options: {},
        type: "http"
      }
    ];

    engine["categorizeChanges"](changes);

    delete changes[0].target.context;

    await engine.onModuleDestroy();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith({...changes[0], kind: ChangeKind.Removed});
  });

  it("should reload function environments when environment variable changed", async () => {
    const env = await evs.insertOne({_id: undefined, key: "IGNORE_ME", value: "NO"});
    const fnId = new ObjectId(hexString);
    await fs.insertOne({
      _id: fnId,
      env_vars: [env._id],
      language: "js",
      timeout: 10,
      name: "my_fn",
      triggers: {test_handler: {active: true, options: {}, type: "http"}}
    });

    await evs.findOneAndUpdate({_id: env._id}, {$set: {value: "YES"}});

    let change: any = {
      kind: ChangeKind.Updated,
      target: {
        id: hexString,
        handler: "test_handler",
        context: {
          env: {IGNORE_ME: "YES"},
          timeout: 10
        }
      },
      options: {},
      type: "http"
    };

    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(change);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(change);
  });

  it("should reload function environments and clear relation when environment variable removed", async () => {
    const env = await evs.insertOne({_id: undefined, key: "IGNORE_ME", value: "NO"});
    const fnId = new ObjectId(hexString);
    await fs.insertOne({
      _id: fnId,
      env_vars: [env._id],
      language: "js",
      timeout: 10,
      name: "my_fn",
      triggers: {test_handler: {active: true, options: {}, type: "http"}}
    });

    await evs.findOneAndDelete({_id: env._id});

    await new Promise(resolve => setTimeout(resolve, 2000));

    const change = {
      kind: ChangeKind.Updated,
      target: {
        id: hexString,
        handler: "test_handler",
        context: {
          env: {},
          timeout: 10
        }
      },
      options: {},
      type: "http"
    };
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(change);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(change);

    const fn = await fs.findOne({_id: fnId});
    expect(fn.env_vars).toEqual([]);
  });

  describe("Database Schema", () => {
    it("should get initial schema", async () => {
      await database.createCollection("function");
      const expectedSchema: any = {
        $id: "http://spica.internal/function/enqueuer/database",
        type: "object",
        required: ["collection", "type"],
        properties: {
          collection: {
            title: "Collection Name",
            type: "string",
            viewEnum: ["function"],
            enum: ["function"],
            description: "Collection name that the event will be tracked on"
          },
          type: {
            title: "Operation type",
            description: "Operation type that must be performed in the specified collection",
            type: "string",
            enum: ["INSERT", "UPDATE", "REPLACE", "DELETE"]
          }
        },
        additionalProperties: false
      };
      const schemaPromise = await engine.getSchema("database");

      expect(schemaPromise).toEqual(expectedSchema);
    });
  });
});
