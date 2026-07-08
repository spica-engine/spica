import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {event} from "@spica-server/function-queue-proto";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import {Scheduler, SchedulerModule} from "@spica-server/function-scheduler";
import {PassThrough} from "stream";
import {WorkerState} from "@spica-server/interface-function-scheduler";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5687";
process.env.DISABLE_LOGGER = "true";

describe("Scheduler", () => {
  let scheduler: Scheduler;
  let app: INestApplication;
  let spawnSpy: jest.SpyInstance;
  let schedulerOptions = {
    invocationLogs: false,
    databaseUri: undefined,
    databaseName: undefined,
    databaseReplicaSet: undefined,
    apiUrl: undefined,
    timeout: 60,
    corsOptions: {
      allowCredentials: true,
      allowedHeaders: ["*"],
      allowedMethods: ["*"],
      allowedOrigins: ["*"]
    },
    maxConcurrency: 2,
    maxWarmWorkers: 10,
    debug: false,
    logger: false,
    workerLogOutput: ["database"] as ("database" | "stdout")[],
    spawnEntrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH,
    tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH
  };
  let module: TestingModule;

  function freeWorkers() {
    return Array.from(scheduler["workers"].entries()).filter(
      ([_, w]) => w.state == WorkerState.Fresh
    );
  }

  function activatedWorkers() {
    return Array.from(scheduler["workers"].entries()).filter(
      ([_, w]) => w.state != WorkerState.Fresh
    );
  }

  function allWorkers() {
    return Array.from(scheduler["workers"].entries());
  }

  function warmWorkers() {
    return Array.from(scheduler["workers"].entries()).filter(
      ([_, w]) => w.state == WorkerState.Warm
    );
  }

  function warmingWorkers() {
    return Array.from(scheduler["workers"].entries()).filter(
      ([_, w]) => w.state == WorkerState.Warming
    );
  }

  // A real warm worker signals readiness by opening its event stream (subscribe) after it
  // finishes pre-loading; here we simulate that by promoting every Warming worker to Warm.
  function connectWarmingWorkers() {
    for (const [id, w] of Array.from(scheduler["workers"].entries())) {
      if (w.state == WorkerState.Warming) {
        scheduler.workerSubscribed(id, () => {});
      }
    }
  }

  function makeTarget(id: string) {
    return new event.Target({
      id,
      cwd: compilation.cwd,
      handler: "default",
      context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
    });
  }

  const now = new Date(2015, 1, 1, 1, 1, 31, 0);

  const compilation = {
    cwd: undefined,
    entrypoints: {
      build: "index.mjs",
      runtime: "index.mjs"
    },
    outDir: ".build"
  };

  function findWorkerFromEventId(evId: string) {
    return Array.from(scheduler.workers.entries()).find(([id, worker]) =>
      worker.hasSameTarget(evId)
    );
  }

  // Completing an event on the worker serving `targetId`: find an in-flight event mapped to
  // that worker and drive the real complete() path (frees the worker's slot, re-runs
  // process() to hand it the next queued event).
  function completeEvent(targetId: string) {
    const found = findWorkerFromEventId(targetId);
    if (!found) return;
    const [workerId] = found;
    const entry = Array.from(scheduler.eventToWorker.entries()).find(([, wId]) => wId == workerId);
    if (entry) {
      scheduler.complete(entry[0], true);
    }
  }

  // A real worker signals readiness by opening its event stream (subscribe); simulate that
  // for a spawned Initial/Fresh worker.
  function triggerGotWorker(_id?: string) {
    const [workerId] = Array.from(scheduler.workers.entries()).find(([id, worker]) => {
      if (_id) return _id == id;
      return worker.state == WorkerState.Initial || worker.state == WorkerState.Fresh;
    });
    scheduler.workerSubscribed(workerId, () => {});
  }

  function triggerLostWorker(evId: string) {
    const [id, worker] = findWorkerFromEventId(evId);
    scheduler.lostWorker(id);
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone(), SchedulerModule.forRoot(schedulerOptions)]
    }).compile();
    module.enableShutdownHooks();

    scheduler = module.get(Scheduler);

    const enqueue = scheduler.enqueue;
    scheduler.enqueue = (event: event.Event) => {
      enqueue.bind(scheduler)(event);
      // we need to trigger this method manually
      // this happens automatically in real scenarios
      triggerGotWorker();
    };

    spawnSpy = jest.spyOn(scheduler.runtimes.get("node"), "spawn");

    app = module.createNestApplication();

    jest.useFakeTimers({doNotFake: ["setImmediate"]});
    jest.setSystemTime(now);

    await app.init();

    compilation.cwd = FunctionTestBed.initialize(`export default function() {}`, compilation);
    await scheduler.languages.get("javascript").compile(compilation);

    triggerGotWorker();
  });

  afterEach(async () => {
    scheduler.kill();
    jest.useRealTimers();
    spawnSpy.mockReset();
  });

  it("should spawn on module init", () => {
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  });

  it("should not spawn if there is one worker available", () => {
    spawnSpy.mockReset();
    scheduler["scaleWorkers"]();
    expect(spawnSpy).toHaveBeenCalledTimes(0);
  });

  it("should attach outputs when the event is enqueued", () => {
    const [[id, worker]] = freeWorkers();
    const attachSpy = jest.spyOn(worker, "attach");

    const ev = new event.Event({
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1 as any
    });

    scheduler.enqueue(ev);

    expect(attachSpy).toHaveBeenCalledTimes(1);
  });

  it("should not accumulate attached output streams across executions on the same worker", () => {
    // Reproduces the duplicate-logs bug: a worker is reused for sequential
    // executions of the same function. Every execution attaches a fresh set of
    // log output streams, so without detaching the previous set the pipes pile
    // up and each console.log is written to the database once per past run
    // (1, then 2, then 3 ... duplicates).
    const outputCount = scheduler["outputs"].length;

    const makeEvent = () =>
      new event.Event({
        target: new event.Target({
          id: "1",
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
        }),
        type: -1 as any
      });

    for (let run = 0; run < 3; run++) {
      scheduler.enqueue(makeEvent());

      const [, worker] = findWorkerFromEventId("1");
      // Exactly one set of output streams must be attached per execution,
      // regardless of how many times the worker has already run.
      expect(worker["_attachedStdouts"].length).toEqual(outputCount);
      expect(worker["_attachedStderrs"].length).toEqual(outputCount);

      // simulate the execution completing so the same worker is reused next run
      completeEvent("1");
    }
  });

  it("should spawn a worker after event scheduled", () => {
    const ev = new event.Event({
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1 as any
    });

    scheduler.enqueue(ev);

    expect(allWorkers().length).toEqual(2);
    expect(activatedWorkers().length).toEqual(1);
    expect(freeWorkers().length).toEqual(1);
  });

  it("should kill the worker when the execution is timed out", () => {
    const [[id, worker]] = freeWorkers();
    const kill = jest.spyOn(worker, "kill");

    const stream = new PassThrough();
    jest.spyOn(scheduler["outputs"][0], "create").mockReturnValue([stream, stream]);

    const write = jest.spyOn(stream, "write");

    const ev = new event.Event({
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1 as any
    });
    scheduler.enqueue(ev);
    expect(kill).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();

    jest.advanceTimersByTime(schedulerOptions.timeout * 1000);

    expect(kill).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      "60 seconds timeout value has been reached for function 'default'. The worker is being shut down."
    );
  });

  it("should pick the minimum timeout value when scheduling", () => {
    const [[id, worker]] = freeWorkers();
    const kill = jest.spyOn(worker, "kill");

    const stream = new PassThrough();
    jest.spyOn(scheduler["outputs"][0], "create").mockReturnValue([stream, stream]);

    const write = jest.spyOn(stream, "write");

    const ev = new event.Event({
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: 10})
      }),
      type: -1 as any
    });
    scheduler.enqueue(ev);

    expect(kill).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10 * 1000);

    expect(kill).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      "10 seconds timeout value has been reached for function 'default'. The worker is being shut down."
    );
  });

  it("should give the same events to the same workers", () => {
    const ev1 = new event.Event({
      target: new event.Target({
        id: "1",
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1 as any
    });

    scheduler.enqueue(ev1);
    // we have to simulate that the ev1 has been completed before another ev1 is enqueued
    // otherwise scheduler will perform concurrent scheduling
    completeEvent("1");

    scheduler.enqueue(ev1);

    expect(allWorkers().length).toEqual(2);
    expect(activatedWorkers().length).toEqual(1);
    expect(freeWorkers().length).toEqual(1);
  });

  it("should take a new worker for different events", () => {
    const ev1 = new event.Event({
      target: new event.Target({
        id: "1",
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1 as any
    });

    const ev2 = new event.Event({
      target: new event.Target({
        id: "2",
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1 as any
    });

    scheduler.enqueue(ev1);
    scheduler.enqueue(ev2);

    expect(scheduler.eventQueue.size).toEqual(0);

    expect(allWorkers().length).toEqual(3);

    const activateds = activatedWorkers();
    expect(activatedWorkers().length).toEqual(2);
    expect(activateds[0][1].hasSameTarget("1")).toEqual(true);
    expect(activateds[1][1].hasSameTarget("2")).toEqual(true);

    expect(freeWorkers().length).toEqual(1);
  });

  it("should perform concurrent scheduling", () => {
    const ev1 = new event.Event({
      target: new event.Target({
        id: "1",
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1 as any
    });

    scheduler.enqueue(ev1);
    scheduler.enqueue(ev1);

    expect(scheduler.eventQueue.size).toEqual(0);

    expect(allWorkers().length).toEqual(3);

    const activateds = activatedWorkers();
    expect(activateds.length).toEqual(2);
    expect(activateds.every(([_, worker]) => worker.hasSameTarget("1"))).toBe(true);

    expect(freeWorkers().length).toEqual(1);
  });

  it("should not exceed the concurreny level", () => {
    // distinct event ids: three concurrent invocations of the same function
    const makeEv = (id: string) =>
      new event.Event({
        id,
        target: new event.Target({
          id: "1",
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
        }),
        type: -1 as any
      });

    scheduler.enqueue(makeEv("e1"));
    scheduler.enqueue(makeEv("e2"));
    scheduler.enqueue(makeEv("e3"));

    // waiting for an available worker
    expect(scheduler.eventQueue.size).toEqual(1);

    expect(allWorkers().length).toEqual(3);

    let activateds = activatedWorkers();
    expect(activateds.length).toEqual(2);
    expect(activateds.every(([_, worker]) => worker.hasSameTarget("1"))).toBe(true);

    expect(freeWorkers().length).toEqual(1);

    // lets complete one of these events
    completeEvent("1");

    expect(scheduler.eventQueue.size).toEqual(0);

    expect(allWorkers().length).toEqual(3);

    activateds = activatedWorkers();
    expect(activateds.length).toEqual(2);
    expect(activateds.every(([_, worker]) => worker.hasSameTarget("1"))).toBe(true);

    expect(freeWorkers().length).toEqual(1);
  });

  describe("per-worker concurrency routing", () => {
    // Stub workers exercise takeAWorker's capacity logic without spawning processes.
    function stubWorker(target: string, inFlight: number, capacity: number, pending: number) {
      const hasSameTarget = (id: string) => target == id;
      const hasFreeSlot = () => pending > 0 && inFlight < capacity;
      return {
        state: WorkerState.Targeted,
        hasSameTarget,
        canServe(id: string) {
          return hasSameTarget(id) && hasFreeSlot();
        },
        canServeWarm() {
          return false;
        },
        isActiveFor(id: string) {
          return hasSameTarget(id);
        },
        isFresh() {
          return false;
        }
      } as any;
    }

    function target(id: string) {
      return new event.Target({
        id,
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      });
    }

    it("should reuse a same-target worker that still has a free lane", () => {
      scheduler.workers.clear();
      const worker = stubWorker("1", 1, 3, 2);
      scheduler.workers.set("w1", worker);

      const picked = scheduler.takeAWorker(target("1"));

      expect(picked).toBeDefined();
      expect(picked.id).toEqual("w1");
      expect(picked.worker).toBe(worker);
    });

    it("should not reuse a same-target worker whose lanes are all busy", () => {
      scheduler.workers.clear();
      const saturated = stubWorker("1", 3, 3, 0);
      scheduler.workers.set("w1", saturated);

      // No fresh worker to fall back to and concurrency is exhausted for this target.
      const picked = scheduler.takeAWorker(target("1"));

      expect(picked).toBeUndefined();
    });
  });

  describe("warm workers", () => {
    it("should spawn warm workers on reconcile and mark them Warm once ready", () => {
      spawnSpy.mockClear();

      scheduler.reconcileWarmWorkers(makeTarget("1"), 2);

      expect(spawnSpy).toHaveBeenCalledTimes(2);
      expect(spawnSpy.mock.calls[0][0].env).toEqual(
        expect.objectContaining({WARM: "true", WARM_CWD: compilation.cwd})
      );
      expect(warmingWorkers().length).toEqual(2);
      expect(warmingWorkers().every(([_, w]) => w.hasSameTarget("1"))).toBe(true);

      connectWarmingWorkers();

      expect(warmingWorkers().length).toEqual(0);
      expect(warmWorkers().length).toEqual(2);
    });

    it("should clamp the warm worker count to maxWarmWorkers", () => {
      spawnSpy.mockClear();

      scheduler.reconcileWarmWorkers(makeTarget("1"), 999);

      const warm = warmingWorkers().length + warmWorkers().length;
      expect(warm).toEqual(schedulerOptions.maxWarmWorkers);
    });

    it("should prefer a warm worker over the cold fresh worker on assignment", () => {
      scheduler.reconcileWarmWorkers(makeTarget("1"), 1);
      connectWarmingWorkers();

      const [[warmId]] = warmWorkers();

      // the untouched cold fresh worker from init
      expect(freeWorkers().length).toEqual(1);

      scheduler.enqueue(
        new event.Event({
          target: makeTarget("1"),
          type: -1 as any
        })
      );

      // the warm worker took the event instead of the cold fresh worker
      const worker = scheduler["workers"].get(warmId);
      expect(worker.state).toEqual(WorkerState.Busy);
      expect(worker.hasSameTarget("1")).toBe(true);

      // cold fresh reserve is untouched, and the warm reserve is being refilled
      expect(freeWorkers().length).toEqual(1);
      expect(warmingWorkers().length).toEqual(1);
    });

    it("should not count warm workers against the concurrency limit", () => {
      // maxConcurrency is 2, but 3 concurrent same-target events are all served
      // because the 3 warm workers are not gated by concurrency.
      scheduler.reconcileWarmWorkers(makeTarget("1"), 3);
      connectWarmingWorkers();

      expect(warmWorkers().length).toEqual(3);

      for (let i = 0; i < 3; i++) {
        scheduler.enqueue(new event.Event({target: makeTarget("1"), type: -1 as any}));
      }

      expect(scheduler.eventQueue.size).toEqual(0);

      const busySameTarget = allWorkers().filter(
        ([_, w]) => w.state == WorkerState.Busy && w.hasSameTarget("1")
      );
      expect(busySameTarget.length).toEqual(3);
    });

    it("should graduate a warm worker and reuse it before the reserve", () => {
      scheduler.reconcileWarmWorkers(makeTarget("1"), 1);
      connectWarmingWorkers();

      const [[warmId]] = warmWorkers();

      scheduler.enqueue(new event.Event({target: makeTarget("1"), type: -1 as any}));
      // graduated worker finishes and becomes Targeted (idle, reusable)
      completeEvent("1");

      const graduated = scheduler["workers"].get(warmId);
      expect(graduated.state).toEqual(WorkerState.Targeted);

      // reserve was refilled after the warm worker was consumed
      connectWarmingWorkers();
      expect(warmWorkers().length).toEqual(1);

      // the next event reuses the graduated worker, leaving the reserve intact
      scheduler.enqueue(new event.Event({target: makeTarget("1"), type: -1 as any}));

      expect(scheduler["workers"].get(warmId).state).toEqual(WorkerState.Busy);
      expect(warmWorkers().length).toEqual(1);
    });

    it("should kill warm workers when the reserve is reduced to zero", () => {
      scheduler.reconcileWarmWorkers(makeTarget("1"), 2);
      connectWarmingWorkers();
      expect(warmWorkers().length).toEqual(2);

      const killSpies = warmWorkers().map(([_, w]) => jest.spyOn(w, "kill"));

      scheduler.reconcileWarmWorkers(makeTarget("1"), 0);

      expect(warmWorkers().length).toEqual(0);
      expect(warmingWorkers().length).toEqual(0);
      expect(scheduler.warmConfigs.has("1")).toBe(false);
      killSpies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    });

    it("should trim in-flight warming workers before ready ones when the reserve is reduced", () => {
      scheduler.reconcileWarmWorkers(makeTarget("1"), 1);
      connectWarmingWorkers();

      const [[readyId, readyWorker]] = warmWorkers();
      const readyKill = jest.spyOn(readyWorker, "kill");

      // grow the reserve; the two refills stay Warming because we don't connect them
      scheduler.reconcileWarmWorkers(makeTarget("1"), 3);
      expect(warmWorkers().length).toEqual(1);
      expect(warmingWorkers().length).toEqual(2);

      const warmingKills = warmingWorkers().map(([_, w]) => jest.spyOn(w, "kill"));

      // reduce back to 1: the two in-flight workers are killed, the ready one is kept
      scheduler.reconcileWarmWorkers(makeTarget("1"), 1);

      expect(warmingWorkers().length).toEqual(0);
      expect(warmWorkers().length).toEqual(1);
      expect(scheduler["workers"].get(readyId).state).toEqual(WorkerState.Warm);
      expect(readyKill).not.toHaveBeenCalled();
      warmingKills.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    });

    it("should replenish the reserve when a warm worker is lost unexpectedly", () => {
      scheduler.reconcileWarmWorkers(makeTarget("1"), 2);
      connectWarmingWorkers();
      expect(warmWorkers().length).toEqual(2);

      const [[lostId]] = warmWorkers();

      spawnSpy.mockClear();
      // simulate a crash/OOM/external kill: the worker exits while still Warm,
      // i.e. without the Outdated marking that intentional teardown applies
      scheduler.lostWorker(lostId);

      // a replacement is spawned to restore the reserve to its desired size
      expect(spawnSpy).toHaveBeenCalledTimes(1);
      expect(warmWorkers().length).toEqual(1);
      expect(warmingWorkers().length).toEqual(1);

      connectWarmingWorkers();
      expect(warmWorkers().length).toEqual(2);
    });

    it("should not refill when a worker is lost while still warming", () => {
      // a module that hard-crashes during preload dies in Warming; refilling there
      // would spin an unthrottled respawn loop, so lostWorker must not replenish
      scheduler.reconcileWarmWorkers(makeTarget("1"), 1);
      expect(warmingWorkers().length).toEqual(1);

      const [[warmingId]] = warmingWorkers();

      spawnSpy.mockClear();
      scheduler.lostWorker(warmingId);

      expect(spawnSpy).not.toHaveBeenCalled();
    });

    it("should not replenish the reserve while shutting down", () => {
      scheduler.reconcileWarmWorkers(makeTarget("1"), 2);
      connectWarmingWorkers();

      const [[lostId]] = warmWorkers();

      scheduler["disabled"] = true;
      spawnSpy.mockClear();
      scheduler.lostWorker(lostId);

      expect(spawnSpy).not.toHaveBeenCalled();
    });

    it("should refresh the reserve on update: kill outdated workers, respawn fresh, no double-refill", () => {
      // mirrors the engine update flow (outdateWorkers -> reconcileWarmWorkers)
      scheduler.reconcileWarmWorkers(makeTarget("1"), 2);
      connectWarmingWorkers();
      expect(warmWorkers().length).toEqual(2);

      const [[oldId, oldWorker]] = warmWorkers();
      const oldKill = jest.spyOn(oldWorker, "kill");

      // step 1: the update outdates the current reserve (kills warm/warming workers)
      scheduler.outdateWorkers("1");
      expect(oldWorker.state).toEqual(WorkerState.Outdated);
      expect(oldKill).toHaveBeenCalled();
      expect(warmWorkers().length).toEqual(0);

      // step 2: reconcile respawns a fresh reserve with the new code/env
      spawnSpy.mockClear();
      scheduler.reconcileWarmWorkers(makeTarget("1"), 2);
      expect(spawnSpy).toHaveBeenCalledTimes(2);
      expect(warmingWorkers().length).toEqual(2);

      // the outdated workers dying must NOT trigger an extra refill — they exit
      // Outdated, not Warm/Warming, so lostWorker's replenish path is skipped
      spawnSpy.mockClear();
      scheduler.lostWorker(oldId);
      expect(spawnSpy).not.toHaveBeenCalled();
    });

    it("should outdate and kill warm workers when their target is outdated", () => {
      scheduler.reconcileWarmWorkers(makeTarget("1"), 1);
      connectWarmingWorkers();

      const [[, worker]] = warmWorkers();
      const kill = jest.spyOn(worker, "kill");

      scheduler.outdateWorkers("1");

      expect(worker.state).toEqual(WorkerState.Outdated);
      expect(kill).toHaveBeenCalledTimes(1);
      expect(warmWorkers().length).toEqual(0);
    });
  });

  describe("onModuleDestroy", () => {
    function getEvent(id: string) {
      return new event.Event({
        target: new event.Target({
          id,
          cwd: compilation.cwd,
          handler: "default",
          context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
        }),
        type: -1 as any
      });
    }

    function onFreeWorkersAreKilled() {
      return new Promise((resolve, reject) => {
        const kill = scheduler.killFreeWorkers;
        scheduler.killFreeWorkers = () => {
          return kill
            .bind(scheduler)()
            .then(() => {
              resolve("");
            });
        };
      });
    }

    function onEventQueueIsEmpty() {
      return new Promise((resolve, reject) => {
        const clear = scheduler.eventQueue.clear;
        scheduler.eventQueue.clear = () => {
          clear.bind(scheduler.eventQueue)();
          resolve("");
        };
      });
    }

    // function onWorkerTimeoutExceeded() {
    //   return new Promise((resolve, reject) => {
    //     setTimeout(resolve, schedulerOptions.timeout);
    //   });
    // }

    it("should clean up if there is no busy worker", async () => {
      expect(allWorkers().length).toEqual(1);
      expect(freeWorkers().length).toEqual(1);

      await module.close();

      expect(allWorkers().length).toEqual(0);
    });

    it("should wait until last worker gets killed", done => {
      const copyDone = done;
      done = undefined;

      const ev1 = getEvent("1");

      scheduler.enqueue(ev1);

      expect(activatedWorkers().length).toEqual(1);
      expect(freeWorkers().length).toEqual(1);

      onFreeWorkersAreKilled().then(() => {
        // to be sure this promise has resolved before module close
        done = copyDone;
        expect(activatedWorkers().length).toEqual(1);
        expect(freeWorkers().length).toEqual(0);
        triggerLostWorker("1");
      });

      app.close().then(() => {
        expect(allWorkers().length).toEqual(0);
        done();
      });
    });

    it("should clear event queue", done => {
      const copyDone = done;
      done = undefined;

      jest.useRealTimers();

      const ev1 = getEvent("1");

      scheduler.enqueue(ev1);
      scheduler.enqueue(ev1);
      scheduler.enqueue(ev1);

      // last event is still be in the event queue because of the concurrency limit
      expect(scheduler.eventQueue.size).toEqual(1);

      module.close().then(() => {
        expect(allWorkers().length).toEqual(0);
        expect(scheduler.eventQueue.size).toEqual(0);
        done();
      });

      onEventQueueIsEmpty().then(() => {
        // to be sure this promise has resolved before module close
        done = copyDone;
        expect(scheduler.eventQueue.size).toEqual(0);
        triggerLostWorker("1");
        triggerLostWorker("1");
      });
    });
  });
});
