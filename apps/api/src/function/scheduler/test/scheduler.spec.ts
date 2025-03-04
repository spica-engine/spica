import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {event} from "@spica-server/function/queue/proto";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";
import {PassThrough} from "stream";
import {WorkerState} from "@spica-server/function/scheduler";

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
    debug: false,
    logger: false,
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

  const now = new Date(2015, 1, 1, 1, 1, 31, 0);

  const compilation = {
    cwd: undefined,
    entrypoint: "index.mjs",
    outDir: ".build"
  };

  function findWorkerFromEventId(evId: string) {
    return Array.from(scheduler.workers.entries()).find(([id, worker]) =>
      worker.hasSameTarget(evId)
    );
  }

  function completeEvent(evId: string) {
    const [id, worker] = findWorkerFromEventId(evId);
    triggerGotWorker(id);
  }

  function triggerGotWorker(_id?: string) {
    const [workerId] = Array.from(scheduler.workers.entries()).find(([id, worker]) =>
      _id ? _id == id : worker.state == WorkerState.Fresh
    );
    scheduler.gotWorker(workerId, () => {});
  }

  function triggerLostWorker(evId: string) {
    const [id, worker] = findWorkerFromEventId(evId);
    scheduler.lostWorker(id);
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), SchedulerModule.forRoot(schedulerOptions)]
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

    compilation.cwd = FunctionTestBed.initialize(
      `export default function() {}`,
      compilation.entrypoint
    );
    await scheduler.languages.get("javascript").compile(compilation);

    triggerGotWorker();
  });

  afterEach(async () => {
    scheduler.kill();
    await app.close();
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
    jest.spyOn(scheduler["output"], "create").mockReturnValue([stream, stream]);

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
    jest.spyOn(scheduler["output"], "create").mockReturnValue([stream, stream]);

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
    scheduler.enqueue(ev1);

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
