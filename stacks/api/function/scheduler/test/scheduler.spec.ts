import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {event} from "@spica-server/function/queue/proto";
import {Worker} from "@spica-server/function/runtime";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";
import {PassThrough} from "stream";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5687";

describe("Scheduler", () => {
  let scheduler: Scheduler;
  let app: INestApplication;
  let spawnSpy: jasmine.Spy;
  let schedulerOptions = {
    databaseUri: undefined,
    databaseName: undefined,
    databaseReplicaSet: undefined,
    poolSize: 1,
    poolMaxSize: 2,
    apiUrl: undefined,
    timeout: 60,
    corsOptions: {
      allowCredentials: true,
      allowedHeaders: ["*"],
      allowedMethods: ["*"],
      allowedOrigins: ["*"]
    }
  };

  const now = new Date(2015, 1, 1, 1, 1, 31, 0);

  let clock: jasmine.Clock;

  const compilation = {
    cwd: undefined,
    entrypoint: "index.js"
  };

  let workerId: string;
  let worker: Worker;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), SchedulerModule.forRoot(schedulerOptions)]
    }).compile();

    scheduler = module.get(Scheduler);

    spawnSpy = spyOn(scheduler.runtimes.get("node"), "spawn").and.callThrough();

    app = module.createNestApplication();

    clock = jasmine.clock();
    clock.mockDate(now);
    clock.install();

    await app.init();

    compilation.cwd = FunctionTestBed.initialize(
      `export default function() {}`,
      compilation.entrypoint
    );
    await scheduler.languages.get("javascript").compile(compilation);

    const [id, _worker] = Array.from(scheduler["pool"].entries())[0] as [string, Worker];
    workerId = id;
    worker = _worker;

    // initalize a worker
    scheduler.gotWorker(workerId, () => {});
  });

  afterEach(() => {
    scheduler.kill();
    app.close();
    clock.uninstall();
  });

  it("should spawn N process", () => {
    expect(spawnSpy).toHaveBeenCalledTimes(schedulerOptions.poolSize);
  });

  it("should spawn max N process", () => {
    expect(spawnSpy).toHaveBeenCalledTimes(schedulerOptions.poolSize);

    scheduler["spawn"]();

    scheduler["spawn"]();

    scheduler["spawn"]();

    expect(spawnSpy).toHaveBeenCalledTimes(2);
  });

  it("should attach outputs when the event enqueued", () => {
    const attachSpy = spyOn(worker, "attach");

    const ev = new event.Event({
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1
    });

    scheduler.enqueue(ev);

    expect(attachSpy).toHaveBeenCalled();
  });

  it("should kill the worker when the execution times out", () => {
    const kill = spyOn(worker, "kill");

    const stream = new PassThrough();
    spyOn(scheduler["output"], "create").and.returnValue([stream, stream]);

    const write = spyOn(stream, "write");

    const ev = new event.Event({
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1
    });
    scheduler.enqueue(ev);

    expect(kill).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();

    clock.tick(schedulerOptions.timeout * 1000);

    expect(kill).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      "Function (default) did not finish within 60 seconds. Aborting."
    );
  });

  it("should pick the minimum timeout value when scheduling", () => {
    const kill = spyOn(worker, "kill");

    const stream = new PassThrough();
    spyOn(scheduler["output"], "create").and.returnValue([stream, stream]);

    const write = spyOn(stream, "write");

    const ev = new event.Event({
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: 10})
      }),
      type: -1
    });
    scheduler.enqueue(ev);

    expect(kill).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();

    clock.tick(10 * 1000);

    expect(kill).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      "Function (default) did not finish within 10 seconds. Aborting."
    );
  });

  it("should not write to stderr when the function quits within the timeout frame, clear pool and workers", () => {
    const stream = new PassThrough();
    spyOn(scheduler["output"], "create").and.returnValue([stream, stream]);

    const write = spyOn(stream, "write");

    const ev = new event.Event({
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: 10})
      }),
      type: -1
    });
    scheduler.enqueue(ev);

    expect(write).not.toHaveBeenCalled();

    worker.emit("exit");

    expect(scheduler["pool"].size).toEqual(0);
    expect(scheduler["workers"].size).toEqual(0);

    expect(write).not.toHaveBeenCalled();
  });

  it("should cancel the event and delete it from processing queue", () => {
    const ev = new event.Event({
      id: "custom_event",
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1
    });
    scheduler.enqueue(ev);

    expect(scheduler["processingQueue"].get(ev.id)).toEqual(ev);

    scheduler["cancel"](ev.id);

    expect(scheduler["processingQueue"].has(ev.id)).toEqual(false);
  });

  it("should create batch for event", () => {
    const ev = new event.Event({
      target: new event.Target({
        id: "my_target",
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({
          env: [],
          timeout: schedulerOptions.timeout,
          batch: new event.SchedulingContext.Batch({
            limit: 2,
            deadline: 10
          })
        })
      }),
      type: -1
    });

    scheduler.enqueue(ev);

    expect(scheduler.batching.get(workerId)).toEqual({
      schedule: scheduler.workers.get(workerId),
      workerId: workerId,
      deadline: now.getTime() + 10 * 1000,
      last_enqueued_at: {
        default: now.getTime()
      },
      remaining_enqueues: {
        default: 1
      },
      started_at: now.getTime(),
      target: "my_target"
    });
  });

  fit("should use batching, release finished batchs", () => {
    const ev = new event.Event({
      target: new event.Target({
        id: "my_target",
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({
          env: [],
          timeout: schedulerOptions.timeout,
          batch: new event.SchedulingContext.Batch({
            limit: 2,
            deadline: 10
          })
        })
      }),
      type: -1
    });

    scheduler.enqueue(ev);
    scheduler.gotWorker(workerId, () => {});

    expect(scheduler.batching.get(workerId).remaining_enqueues.default).toEqual(1);
    expect(scheduler.workers.size).toEqual(0);
    expect(scheduler.batching.size).toEqual(1);

    const releaseSpy = spyOn(scheduler, "releaseFinishedBatches");

    scheduler.enqueue(ev);
    scheduler.gotWorker(workerId, () => {});
    expect(scheduler.batching.get(workerId).remaining_enqueues.default).toEqual(0);
    expect(scheduler.workers.size).toEqual(0);
    expect(scheduler.batching.size).toEqual(1);

    expect(releaseSpy).toHaveBeenCalledTimes(1);
  });
});
