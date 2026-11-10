import {provideRepository} from "@spica-server/data";
import {
  COLLECTION_NAMES,
  COLLECTION_QUERY,
  CollectionNames,
  ID_TYPES,
  IdTypes
} from "@spica-server/interface-data";
import {Test, TestingModule} from "@nestjs/testing";
import {
  contractSuite,
  ensureCollections,
  QuietChangeFeedModule
} from "@spica-server/database-testing";
import {ENV_VAR_REPOSITORY} from "@spica-server/interface-env_var";
import {SECRET_REPOSITORY} from "@spica-server/interface-secret";
import {Scheduler, SchedulerModule} from "@spica-server/function-scheduler";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {PlanExecutor} from "@spica-server/function/src/plan-executor";
import {TriggerSecretResolver} from "@spica-server/function/src/trigger-secret-resolver";
import {FunctionPreparationService} from "@spica-server/function/src/function-preparation.service";
import {FunctionService} from "@spica-server/function-services";
import {INestApplication} from "@nestjs/common";
import {EnvVarService, EnvVarChangeDispatcher} from "@spica-server/env_var-services";
import {
  ChangeKind,
  FUNCTION_OPTIONS,
  FUNCTION_REPOSITORY,
  FunctionRepository
} from "@spica-server/interface-function";
import {SecretService, SecretChangeDispatcher} from "@spica-server/secret-services";
import {encrypt} from "@spica-server/core-encryption";
import {getFreeAddress} from "@spica-server/core-testing";

function envMap(context: any): {[key: string]: unknown} {
  const obj = context ? context.toObject() : {env: []};
  return (obj.env || []).reduce((acc, e) => {
    acc[e.key] = e.value;
    return acc;
  }, {});
}

contractSuite("Engine", contract => {
  let engine: FunctionEngine;
  let executor: PlanExecutor;
  let subscribeSpy: jest.SpyInstance;
  let unsubscribeSpy: jest.SpyInstance;

  let scheduler: Scheduler;
  let fs: FunctionService;
  let functions: FunctionRepository;
  let evs: EnvVarService;
  let ss: SecretService;

  let module: TestingModule;
  let app: INestApplication;

  let functionKey: any;
  let functionId: string;

  beforeEach(async () => {
    process.env.FUNCTION_GRPC_ADDRESS = await getFreeAddress();
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
        contract.module(),
        QuietChangeFeedModule
      ],
      providers: [
        {provide: FUNCTION_OPTIONS, useValue: {entryLimit: 4}},
        provideRepository(ENV_VAR_REPOSITORY),
        provideRepository(SECRET_REPOSITORY),
        provideRepository(FUNCTION_REPOSITORY)
      ]
    }).compile();

    app = module.createNestApplication();

    scheduler = module.get(Scheduler);
    functionKey = module.get<IdTypes>(ID_TYPES).forCollection("function").generate();
    functionId = String(functionKey);

    evs = new EnvVarService(module.get(ENV_VAR_REPOSITORY), new EnvVarChangeDispatcher());
    ss = new SecretService(
      module.get(SECRET_REPOSITORY),
      "test-encryption-secret",
      new SecretChangeDispatcher()
    );

    functions = module.get(FUNCTION_REPOSITORY);
    fs = new FunctionService(functions, evs, ss);

    const options = {root: "test_root", timeout: 1, outDir: ".build"} as any;
    executor = new PlanExecutor(
      module.get(COLLECTION_QUERY),
      scheduler,
      (val => val) as any,
      options,
      new TriggerSecretResolver(module.get(COLLECTION_QUERY), (val => val) as any),
      new FunctionPreparationService(scheduler, options)
    );
    engine = new FunctionEngine(
      fs,
      module.get(COLLECTION_NAMES),
      scheduler,
      undefined,
      options,
      undefined,
      undefined,
      executor,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      functions
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
    await functions.insert({
      _id: functionKey,
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
      target: {id: functionId, handler: "test_handler", name: "my_fn"}
    });
  });

  it("should refresh workers and context without re-routing when an env var value changes", async () => {
    const contextSpy = jest.spyOn(scheduler, "reconcileContext");
    // an active-trigger function rolls over via supersedeWorkers (keep serving old code while
    // fresh replacements warm), not a hard outdateWorkers.
    const supersedeSpy = jest.spyOn(scheduler, "supersedeWorkers");

    const env = await evs.insert({_id: undefined, key: "IGNORE_ME", value: "NO"});
    const fnId = functionKey;
    await functions.insert({
      _id: fnId,
      env_vars: [env._id],
      language: "js",
      timeout: 10,
      name: "my_fn",
      triggers: {test_handler: {active: true, options: {}, type: "http"}}
    });

    await evs.updateById(env._id, {value: "YES"});

    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(unsubscribeSpy).not.toHaveBeenCalled();

    expect(supersedeSpy.mock.calls.at(-1)[0].toObject().id).toBe(functionId);
    expect(envMap(contextSpy.mock.calls.at(-1)[1])).toEqual({IGNORE_ME: "YES"});
  });

  it("should clear the env relation and context when an env var is removed", async () => {
    const contextSpy = jest.spyOn(scheduler, "reconcileContext");

    const env = await evs.insert({_id: undefined, key: "IGNORE_ME", value: "NO"});
    const fnId = functionKey;
    await functions.insert({
      _id: fnId,
      env_vars: [env._id],
      language: "js",
      timeout: 10,
      name: "my_fn",
      triggers: {test_handler: {active: true, options: {}, type: "http"}}
    });

    await evs.deleteById(env._id);

    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(unsubscribeSpy).not.toHaveBeenCalled();
    expect(envMap(contextSpy.mock.calls.at(-1)[1])).toEqual({});

    const fn = await functions.findById(fnId);
    expect(fn.env_vars).toEqual([]);
  });

  it("should refresh context without re-routing when a secret value changes", async () => {
    const contextSpy = jest.spyOn(scheduler, "reconcileContext");

    const encryptionSecret = "test-encryption-secret";
    const encryptedValue = encrypt("secret_value", encryptionSecret);
    const secret = await ss.insert({
      _id: undefined,
      key: "DB_PASSWORD",
      value: encryptedValue
    });
    const fnId = functionKey;
    await functions.insert({
      _id: fnId,
      env_vars: [],
      secrets: [secret._id],
      language: "js",
      timeout: 10,
      name: "my_fn",
      triggers: {test_handler: {active: true, options: {}, type: "http"}}
    });

    const newEncryptedValue = encrypt("new_secret_value", encryptionSecret);
    await ss.updateById(secret._id, {value: newEncryptedValue});

    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(unsubscribeSpy).not.toHaveBeenCalled();
    expect(envMap(contextSpy.mock.calls.at(-1)[1])).toHaveProperty("DB_PASSWORD");
  });

  it("should clear the secret relation and context when a secret is removed", async () => {
    const contextSpy = jest.spyOn(scheduler, "reconcileContext");

    const encryptionSecret = "test-encryption-secret";
    const encryptedValue = encrypt("secret_value", encryptionSecret);
    const secret = await ss.insert({
      _id: undefined,
      key: "REMOVED_SECRET",
      value: encryptedValue
    });
    const fnId = functionKey;
    await functions.insert({
      _id: fnId,
      env_vars: [],
      secrets: [secret._id],
      language: "js",
      timeout: 10,
      name: "my_fn",
      triggers: {test_handler: {active: true, options: {}, type: "http"}}
    });

    await ss.deleteById(secret._id);

    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(unsubscribeSpy).not.toHaveBeenCalled();
    expect(envMap(contextSpy.mock.calls.at(-1)[1])).not.toHaveProperty("REMOVED_SECRET");

    const fn = await functions.findById(fnId);
    expect(fn.secrets).toEqual([]);
  });

  it("should get initial schema for database trigger", async () => {
    await ensureCollections(contract, module, ["dashboard"]);
    const [collection] = [...(await module.get<CollectionNames>(COLLECTION_NAMES).list())].sort();
    const expectedSchema: any = {
      $id: "http://spica.internal/function/enqueuer/database",
      type: "object",
      required: ["collection", "type"],
      properties: {
        collection: {
          title: "Collection Name",
          type: "string",
          viewEnum: expect.arrayContaining([collection]),
          enum: expect.arrayContaining([collection]),
          description: "Collection name that the event will be tracked on"
        },
        type: {
          title: "Operation type",
          description: "Operation type that must be performed in the specified collection",
          type: "string",
          enum: module
            .get<CollectionNames>(COLLECTION_NAMES)
            .changeOperations()
            .map(operation => operation.toUpperCase())
        }
      },
      additionalProperties: false
    };
    const schemaPromise = await engine.getSchema("database");

    expect(schemaPromise).toEqual(expectedSchema);
  });

  it("should offer REPLACE for database triggers only on engines that report replacements", async () => {
    const schema: any = await engine.getSchema("database");

    expect(schema.properties.type.enum).toEqual(
      contract.name == "mongodb"
        ? ["INSERT", "UPDATE", "REPLACE", "DELETE"]
        : ["INSERT", "UPDATE", "DELETE"]
    );
  });
});
