import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {Scheduler, SchedulerModule} from "@spica-server/function-scheduler";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {PlanExecutor} from "@spica-server/function/src/plan-executor";
import {FunctionService} from "@spica-server/function-services";
import {INestApplication} from "@nestjs/common";
import {EnvVarService, EnvVarChangeDispatcher} from "@spica-server/env_var-services";
import {ChangeKind} from "@spica-server/interface-function";
import {SecretService, SecretChangeDispatcher} from "@spica-server/secret-services";
import {encrypt} from "@spica-server/core-encryption";
process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:4378";

function envMap(context: any): {[key: string]: unknown} {
  const obj = context ? context.toObject() : {env: []};
  return (obj.env || []).reduce((acc, e) => {
    acc[e.key] = e.value;
    return acc;
  }, {});
}

describe("Engine", () => {
  let engine: FunctionEngine;
  let executor: PlanExecutor;
  let subscribeSpy: jest.SpyInstance;
  let unsubscribeSpy: jest.SpyInstance;

  let scheduler: Scheduler;
  let database: DatabaseService;
  let fs: FunctionService;
  let evs: EnvVarService;
  let ss: SecretService;

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
          maxWarmWorkers: 0,
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

    evs = new EnvVarService(database, new EnvVarChangeDispatcher());
    ss = new SecretService(database, "test-encryption-secret", new SecretChangeDispatcher());

    fs = new FunctionService(database, evs, ss, {} as any);

    const options = {root: "test_root", timeout: 1, outDir: ".build"} as any;
    executor = new PlanExecutor(fs, scheduler, (val => val) as any, options);
    engine = new FunctionEngine(
      fs,
      database,
      scheduler,
      undefined,
      options,
      undefined,
      undefined,
      executor
    );

    await app.init();

    subscribeSpy = jest.spyOn(executor as any, "subscribe").mockReturnValue(undefined);
    unsubscribeSpy = jest.spyOn(executor as any, "unsubscribe").mockReturnValue(undefined);
  });

  afterEach(async () => {
    try {
      subscribeSpy.mockReset();
      unsubscribeSpy.mockReset();
      await app.close();
    } catch (error) {
      console.error(error);
    }
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

    await engine.onModuleDestroy();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith({
      kind: ChangeKind.Removed,
      options: {},
      type: "http",
      target: {id: hexString, handler: "test_handler", name: "my_fn"}
    });
  });

  it("should refresh workers and context without re-routing when an env var value changes", async () => {
    const contextSpy = jest.spyOn(scheduler, "reconcileContext");
    const outdateSpy = jest.spyOn(scheduler, "outdateWorkers");

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

    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(unsubscribeSpy).not.toHaveBeenCalled();

    expect(outdateSpy).toHaveBeenCalledWith(hexString);
    expect(envMap(contextSpy.mock.calls.at(-1)[1])).toEqual({IGNORE_ME: "YES"});
  });

  it("should clear the env relation and context when an env var is removed", async () => {
    const contextSpy = jest.spyOn(scheduler, "reconcileContext");

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

    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(unsubscribeSpy).not.toHaveBeenCalled();
    expect(envMap(contextSpy.mock.calls.at(-1)[1])).toEqual({});

    const fn = await fs.findOne({_id: fnId});
    expect(fn.env_vars).toEqual([]);
  });

  it("should refresh context without re-routing when a secret value changes", async () => {
    const contextSpy = jest.spyOn(scheduler, "reconcileContext");

    const encryptionSecret = "test-encryption-secret";
    const encryptedValue = encrypt("secret_value", encryptionSecret);
    const secret = await ss.insertOne({
      _id: undefined,
      key: "DB_PASSWORD",
      value: encryptedValue
    });
    const fnId = new ObjectId(hexString);
    await fs.insertOne({
      _id: fnId,
      env_vars: [],
      secrets: [secret._id],
      language: "js",
      timeout: 10,
      name: "my_fn",
      triggers: {test_handler: {active: true, options: {}, type: "http"}}
    });

    const newEncryptedValue = encrypt("new_secret_value", encryptionSecret);
    await ss.findOneAndUpdate({_id: secret._id}, {$set: {value: newEncryptedValue}});

    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(unsubscribeSpy).not.toHaveBeenCalled();
    expect(envMap(contextSpy.mock.calls.at(-1)[1])).toHaveProperty("DB_PASSWORD");
  });

  it("should clear the secret relation and context when a secret is removed", async () => {
    const contextSpy = jest.spyOn(scheduler, "reconcileContext");

    const encryptionSecret = "test-encryption-secret";
    const encryptedValue = encrypt("secret_value", encryptionSecret);
    const secret = await ss.insertOne({
      _id: undefined,
      key: "REMOVED_SECRET",
      value: encryptedValue
    });
    const fnId = new ObjectId(hexString);
    await fs.insertOne({
      _id: fnId,
      env_vars: [],
      secrets: [secret._id],
      language: "js",
      timeout: 10,
      name: "my_fn",
      triggers: {test_handler: {active: true, options: {}, type: "http"}}
    });

    await ss.findOneAndDelete({_id: secret._id});

    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(unsubscribeSpy).not.toHaveBeenCalled();
    expect(envMap(contextSpy.mock.calls.at(-1)[1])).not.toHaveProperty("REMOVED_SECRET");

    const fn = await fs.findOne({_id: fnId});
    expect(fn.secrets).toEqual([]);
  });

  it("should get initial schema for database trigger", async () => {
    await database.createCollection("test");
    const expectedSchema: any = {
      $id: "http://spica.internal/function/enqueuer/database",
      type: "object",
      required: ["collection", "type"],
      properties: {
        collection: {
          title: "Collection Name",
          type: "string",
          viewEnum: expect.arrayContaining(["test"]),
          enum: expect.arrayContaining(["test"]),
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
