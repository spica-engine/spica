import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {Scheduler, SchedulerModule} from "@spica-server/function-scheduler";
import {PlanExecutor} from "@spica-server/function/src/plan-executor";
import {FunctionService} from "@spica-server/function-services";
import {INestApplication} from "@nestjs/common";
import {EnvVarService, EnvVarChangeDispatcher} from "@spica-server/env_var-services";
import {TargetChange, ChangeKind, FunctionChangePlan} from "@spica-server/interface-function";
import {SecretService, SecretChangeDispatcher} from "@spica-server/secret-services";
process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:4379";

describe("PlanExecutor", () => {
  let executor: PlanExecutor;
  let subscribeSpy: jest.SpyInstance;
  let unsubscribeSpy: jest.SpyInstance;

  let scheduler: Scheduler;
  let database: DatabaseService;
  let fs: FunctionService;

  let module: TestingModule;
  let app: INestApplication;

  const hexString = "507f1f77bcf86cd799439011";

  const apply = (plan: FunctionChangePlan) => executor.apply(plan);
  const routing = (changes: TargetChange[]): FunctionChangePlan => ({
    routing: changes,
    outdate: [],
    reconcile: []
  });

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

    const evs = new EnvVarService(database, new EnvVarChangeDispatcher());
    const ss = new SecretService(database, "test-encryption-secret", new SecretChangeDispatcher());
    fs = new FunctionService(database, evs, ss, {} as any);

    executor = new PlanExecutor(fs, scheduler, (val => val) as any, {
      root: "test_root",
      timeout: 1,
      outDir: ".build"
    } as any);

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

  it("should subscribe a new trigger", () => {
    const change: TargetChange = {
      kind: ChangeKind.Added,
      target: {id: "test_id", handler: "test_handler", name: "test_function"}
    };

    apply(routing([change]));

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(change);
    expect(unsubscribeSpy).not.toHaveBeenCalled();
  });

  it("should unsubscribe a removed trigger", () => {
    const change: TargetChange = {
      kind: ChangeKind.Removed,
      target: {id: "test_id", handler: "test_handler", name: "test_function"}
    };

    apply(routing([change]));

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(change);
    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  it("should unsubscribe then subscribe an updated trigger", () => {
    const change: TargetChange = {
      kind: ChangeKind.Updated,
      target: {id: "test_id", handler: "test_handler", name: "test_function"}
    };

    apply(routing([change]));

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(change);
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(change);
  });

  it("should not outdate workers on a routing update", () => {
    const outdateSpy = jest.spyOn(scheduler, "outdateWorkers");

    apply(
      routing([
        {
          kind: ChangeKind.Updated,
          target: {id: "test_id", handler: "test_handler", name: "test_function"}
        }
      ])
    );

    expect(outdateSpy).not.toHaveBeenCalled();
  });

  it("should build a routing-only target that carries no execution context", () => {
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
    apply(routing([change]));

    const target = httpSubscribe.mock.calls[httpSubscribe.mock.calls.length - 1][0].toObject();
    expect(target.id).toBe("test_id");
    expect(target.cwd).toBe("test_root/test_function");
    expect(target.handler).toBe("test_handler");
    expect(target.context).toBeFalsy();
  });

  it("should reconcile warm workers per function, surviving a single-trigger removal", async () => {
    await fs.insertOne({
      _id: new ObjectId(hexString),
      env_vars: [],
      language: "js",
      timeout: 10,
      name: "multi_fn",
      warmWorkers: 2,
      triggers: {
        a: {active: true, options: {}, type: "http"},
        b: {active: true, options: {}, type: "http"}
      }
    });

    const reconcileSpy = jest.spyOn(scheduler, "reconcileWarmWorkers");

    apply({routing: [], outdate: [], reconcile: [hexString]});

    await waitForCalls(reconcileSpy);
    expect(reconcileSpy.mock.calls.at(-1)[1]).toBe(2);
  });

  it("should drain the warm reserve when the function no longer exists", async () => {
    const reconcileSpy = jest.spyOn(scheduler, "reconcileWarmWorkers");

    apply({routing: [], outdate: [], reconcile: [hexString]});

    await waitForCalls(reconcileSpy);
    expect(reconcileSpy.mock.calls.at(-1)[1]).toBe(0);
  });

  it("should outdate stale workers and refill the reserve from current state", async () => {
    await fs.insertOne({
      _id: new ObjectId(hexString),
      env_vars: [],
      language: "js",
      timeout: 10,
      name: "warm_fn",
      warmWorkers: 2,
      triggers: {test_handler: {active: true, options: {}, type: "http"}}
    });

    const outdateSpy = jest.spyOn(scheduler, "outdateWorkers");
    const reconcileSpy = jest.spyOn(scheduler, "reconcileWarmWorkers");

    apply({routing: [], outdate: [hexString], reconcile: [hexString]});

    expect(outdateSpy).toHaveBeenCalledWith(hexString);
    expect(unsubscribeSpy).not.toHaveBeenCalled();

    await waitForCalls(reconcileSpy);
    expect(reconcileSpy.mock.calls.at(-1)[1]).toBe(2);
  });

  it("should reconcile per-function concurrency from the function", async () => {
    await fs.insertOne({
      _id: new ObjectId(hexString),
      env_vars: [],
      language: "js",
      timeout: 10,
      name: "conc_fn",
      concurrencyPerWorker: 4,
      triggers: {a: {active: true, options: {}, type: "http"}}
    });

    const reconcileSpy = jest.spyOn(scheduler, "reconcileConcurrency");

    apply({routing: [], outdate: [], reconcile: [hexString]});

    await waitForCalls(reconcileSpy);
    expect(reconcileSpy.mock.calls.at(-1)[1]).toBe(4);
  });

  it("should reset concurrency to the default when the function no longer exists", async () => {
    const reconcileSpy = jest.spyOn(scheduler, "reconcileConcurrency");

    apply({routing: [], outdate: [], reconcile: [hexString]});

    await waitForCalls(reconcileSpy);
    expect(reconcileSpy.mock.calls.at(-1)[1]).toBe(1);
  });

  it("should stamp the reconciled execution context into the scheduler", async () => {
    await fs.insertOne({
      _id: new ObjectId(hexString),
      env_vars: [],
      language: "js",
      timeout: 10,
      name: "ctx_fn",
      triggers: {a: {active: true, options: {}, type: "http"}}
    });

    const contextSpy = jest.spyOn(scheduler, "reconcileContext");

    apply({routing: [], outdate: [], reconcile: [hexString]});

    await waitForCalls(contextSpy);
    expect(contextSpy.mock.calls.at(-1)[1].toObject().timeout).toBe(10);
  });
});
