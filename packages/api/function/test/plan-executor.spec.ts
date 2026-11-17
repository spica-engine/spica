import {provideRepository, withId} from "@spica-server/data";
import {COLLECTION_QUERY, ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {Test, TestingModule} from "@nestjs/testing";
import {contractSuite, QuietChangeFeedModule} from "@spica-server/database-testing";
import {ENV_VAR_REPOSITORY} from "@spica-server/interface-env_var";
import {SECRET_REPOSITORY} from "@spica-server/interface-secret";
import {Scheduler, SchedulerModule} from "@spica-server/function-scheduler";
import {PlanExecutor} from "@spica-server/function/src/plan-executor";
import {TriggerSecretResolver} from "@spica-server/function/src/trigger-secret-resolver";
import {FunctionPreparationService} from "@spica-server/function/src/function-preparation.service";
import {FunctionService} from "@spica-server/function-services";
import {INestApplication} from "@nestjs/common";
import {EnvVarService, EnvVarChangeDispatcher} from "@spica-server/env_var-services";
import {
  TargetChange,
  ChangeKind,
  FunctionChangePlan,
  FUNCTION_OPTIONS,
  FUNCTION_REPOSITORY,
  FunctionRepository
} from "@spica-server/interface-function";
import {SecretService, SecretChangeDispatcher} from "@spica-server/secret-services";
import {getFreeAddress} from "@spica-server/core-testing";

contractSuite("PlanExecutor", engine => {
  let executor: PlanExecutor;
  let subscribeSpy: jest.SpyInstance;
  let unsubscribeSpy: jest.SpyInstance;

  let scheduler: Scheduler;
  let fs: FunctionService;
  let functions: FunctionRepository;

  let module: TestingModule;
  let app: INestApplication;

  let functionKey: any;
  let functionId: string;

  const apply = (plan: FunctionChangePlan) => executor.apply(plan);
  const routing = (changes: TargetChange[]): FunctionChangePlan => ({
    routing: changes,
    outdate: [],
    reconcile: []
  });

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
        engine.module(),
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

    const evs = new EnvVarService(module.get(ENV_VAR_REPOSITORY), new EnvVarChangeDispatcher());
    const ss = new SecretService(
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

  async function waitForCalls(spy: jest.SpyInstance, min = 1, timeout = 3000) {
    const start = Date.now();
    while (spy.mock.calls.length < min && Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, 20));
    }
  }

  it("should subscribe a new trigger", async () => {
    const change: TargetChange = {
      kind: ChangeKind.Added,
      target: {id: "test_id", handler: "test_handler", name: "test_function"}
    };

    await apply(routing([change]));

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(change);
    expect(unsubscribeSpy).not.toHaveBeenCalled();
  });

  it("should unsubscribe a removed trigger", async () => {
    const change: TargetChange = {
      kind: ChangeKind.Removed,
      target: {id: "test_id", handler: "test_handler", name: "test_function"}
    };

    await apply(routing([change]));

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(change);
    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  it("should unsubscribe then subscribe an updated trigger", async () => {
    const change: TargetChange = {
      kind: ChangeKind.Updated,
      target: {id: "test_id", handler: "test_handler", name: "test_function"}
    };

    await apply(routing([change]));

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(change);
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(change);
  });

  it("should not outdate workers on a routing update", async () => {
    const outdateSpy = jest.spyOn(scheduler, "outdateWorkers");

    await apply(
      routing([
        {
          kind: ChangeKind.Updated,
          target: {id: "test_id", handler: "test_handler", name: "test_function"}
        }
      ])
    );

    expect(outdateSpy).not.toHaveBeenCalled();
  });

  it("should build a routing-only target that carries no execution context", async () => {
    const change: TargetChange = {
      kind: ChangeKind.Added,
      target: {id: "test_id", handler: "test_handler", name: "test_function"},
      type: "http",
      options: {method: "POST", path: "/test"}
    };

    const httpEnqueuer = Array.from(scheduler.enqueuers).find(
      enqueuer => enqueuer.description.name == "http"
    );
    const httpSubscribe = jest.spyOn(httpEnqueuer, "subscribe");
    subscribeSpy.mockRestore();
    await apply(routing([change]));

    const target = httpSubscribe.mock.calls[httpSubscribe.mock.calls.length - 1][0].toObject();
    expect(target.id).toBe("test_id");
    expect(target.cwd).toBe("test_root/test_function");
    expect(target.handler).toBe("test_handler");
    expect(target.context).toBeFalsy();
  });

  it("should reconcile warm workers per function, surviving a single-trigger removal", async () => {
    await functions.insert(
      withId(
        {
          env_vars: [],
          language: "js",
          timeout: 10,
          name: "multi_fn",
          warmWorkers: 2,
          triggers: {
            a: {active: true, options: {}, type: "http"},
            b: {active: true, options: {}, type: "http"}
          }
        },
        functionKey
      )
    );

    const reconcileSpy = jest.spyOn(scheduler, "reconcileWarmWorkers");

    apply({routing: [], outdate: [], reconcile: [functionId]});

    await waitForCalls(reconcileSpy);
    expect(reconcileSpy.mock.calls.at(-1)[1]).toBe(2);
  });

  it("should drain the warm reserve when the function no longer exists", async () => {
    const reconcileSpy = jest.spyOn(scheduler, "reconcileWarmWorkers");

    apply({routing: [], outdate: [], reconcile: [functionId]});

    await waitForCalls(reconcileSpy);
    expect(reconcileSpy.mock.calls.at(-1)[1]).toBe(0);
  });

  it("should roll active-trigger workers over via supersede and refill the reserve", async () => {
    await functions.insert(
      withId(
        {
          env_vars: [],
          language: "js",
          timeout: 10,
          name: "warm_fn",
          warmWorkers: 2,
          triggers: {test_handler: {active: true, options: {}, type: "http"}}
        },
        functionKey
      )
    );

    const outdateSpy = jest.spyOn(scheduler, "outdateWorkers");
    const supersedeSpy = jest.spyOn(scheduler, "supersedeWorkers");
    const reconcileSpy = jest.spyOn(scheduler, "reconcileWarmWorkers");

    await apply({routing: [], outdate: [functionId], reconcile: [functionId]});

    // an existing function with an active trigger rolls over (supersede + pre-warm), not a hard
    // outdate — that path is reserved for deleted / inactive functions.
    expect(supersedeSpy.mock.calls.at(-1)[0].toObject().id).toBe(functionId);
    expect(outdateSpy).not.toHaveBeenCalled();
    expect(unsubscribeSpy).not.toHaveBeenCalled();

    await waitForCalls(reconcileSpy);
    expect(reconcileSpy.mock.calls.at(-1)[1]).toBe(2);
  });

  it("should hard-outdate when an outdated function is gone", async () => {
    const outdateSpy = jest.spyOn(scheduler, "outdateWorkers");
    const supersedeSpy = jest.spyOn(scheduler, "supersedeWorkers");

    await apply({routing: [], outdate: [functionId], reconcile: [functionId]});

    expect(outdateSpy).toHaveBeenCalledWith(functionId);
    expect(supersedeSpy).not.toHaveBeenCalled();
  });

  it("should reconcile per-function concurrency from the function", async () => {
    await functions.insert(
      withId(
        {
          env_vars: [],
          language: "js",
          timeout: 10,
          name: "conc_fn",
          concurrencyPerWorker: 4,
          triggers: {a: {active: true, options: {}, type: "http"}}
        },
        functionKey
      )
    );

    const reconcileSpy = jest.spyOn(scheduler, "reconcileConcurrency");

    apply({routing: [], outdate: [], reconcile: [functionId]});

    await waitForCalls(reconcileSpy);
    expect(reconcileSpy.mock.calls.at(-1)[1]).toBe(4);
  });

  it("should reset concurrency to the default when the function no longer exists", async () => {
    const reconcileSpy = jest.spyOn(scheduler, "reconcileConcurrency");

    apply({routing: [], outdate: [], reconcile: [functionId]});

    await waitForCalls(reconcileSpy);
    expect(reconcileSpy.mock.calls.at(-1)[1]).toBe(1);
  });

  it("should stamp the reconciled execution context into the scheduler", async () => {
    await functions.insert(
      withId(
        {
          env_vars: [],
          language: "js",
          timeout: 10,
          name: "ctx_fn",
          triggers: {a: {active: true, options: {}, type: "http"}}
        },
        functionKey
      )
    );

    const contextSpy = jest.spyOn(scheduler, "reconcileContext");

    apply({routing: [], outdate: [], reconcile: [functionId]});

    await waitForCalls(contextSpy);
    expect(contextSpy.mock.calls.at(-1)[1].toObject().timeout).toBe(10);
  });

  it("should not resolve apply() until the execution context is reconciled", async () => {
    await functions.insert(
      withId(
        {
          env_vars: [],
          language: "js",
          timeout: 10,
          name: "await_fn",
          triggers: {a: {active: true, options: {}, type: "http"}}
        },
        functionKey
      )
    );

    const contextSpy = jest.spyOn(scheduler, "reconcileContext");

    // awaiting apply must be enough — no polling — for the context to be in the scheduler,
    // otherwise a freshly-subscribed route could serve events before its context is loaded.
    await apply({routing: [], outdate: [], reconcile: [functionId]});

    expect(contextSpy).toHaveBeenCalled();
    expect(contextSpy.mock.calls.at(-1)[1].toObject().timeout).toBe(10);
  });

  describe("rename", () => {
    let renameSpy: jest.SpyInstance;

    beforeEach(() => {
      renameSpy = jest
        .spyOn(executor["preparationService"], "renameFunctionDirectory")
        .mockResolvedValue(undefined);
    });

    it("should move the function directory before routing", async () => {
      const change: TargetChange = {
        kind: ChangeKind.Added,
        target: {id: "test_id", handler: "test_handler", name: "new_name"}
      };

      await apply({...routing([change]), rename: [{from: "old_name", to: "new_name"}]});

      expect(renameSpy).toHaveBeenCalledWith("old_name", "new_name");
      expect(renameSpy.mock.invocationCallOrder[0]).toBeLessThan(
        subscribeSpy.mock.invocationCallOrder[0]
      );
    });

    it("should still route when moving the directory fails", async () => {
      renameSpy.mockRejectedValue(new Error("EACCES"));
      const change: TargetChange = {
        kind: ChangeKind.Added,
        target: {id: "test_id", handler: "test_handler", name: "new_name"}
      };

      await apply({...routing([change]), rename: [{from: "old_name", to: "new_name"}]});

      expect(subscribeSpy).toHaveBeenCalledWith(change);
    });

    it("should not touch directories when the plan has no rename", async () => {
      await apply(routing([]));

      expect(renameSpy).not.toHaveBeenCalled();
    });
  });
});
