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
    poolSize: 2,
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

  let worker1Id: string;
  let worker1: Worker;
  let worker1Schedule: (event) => void;

  let worker2Id: string;
  let worker2: Worker;
  let worker2Schedule: (event) => void;

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

    const [[firstWorkerId, firstWorker], [secondWorkerId, secondWorker]] = Array.from(
      scheduler["pool"].entries()
    );

    worker1Id = firstWorkerId;
    worker1 = firstWorker;

    worker2Id = secondWorkerId;
    worker2 = secondWorker;

    worker1Schedule = event => {
      if (!event) {
        worker1.emit("exit");
      }
    };

    worker2Schedule = event => {
      if (!event) {
        worker2.emit("exit");
      }
    };

    scheduler.gotWorker(worker1Id, worker1Schedule);
    scheduler.gotWorker(worker2Id, worker2Schedule);
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
    const attachSpy = spyOn(worker1, "attach");

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
    const kill = spyOn(worker1, "kill");

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
    const kill = spyOn(worker1, "kill");

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

  it("should not write to stderr when the function quits within the timeout frame, delete worker from pool and workers", () => {
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

    worker1.emit("exit");

    expect(scheduler["pool"].size).toEqual(1);
    expect(scheduler["workers"].size).toEqual(1);

    expect(write).not.toHaveBeenCalled();
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

    expect(scheduler.batching.get(worker1Id)).toEqual({
      schedule: scheduler.workers.get(worker1Id),
      workerId: worker1Id,
      deadline: now.getTime() + 10 * 1000,
      remaining_enqueues: {
        default: 1
      },
      started_at: now.getTime(),
      target: "my_target"
    });
  });

  it("should use limit batching, release finished batches and move batch to the next worker", () => {
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
    scheduler.gotWorker(worker1Id, worker1Schedule);

    const batch = scheduler.batching.get(worker1Id);

    expect(batch.remaining_enqueues.default).toEqual(1);
    expect(batch.deadline).toEqual(now.getTime() + 10 * 1000);

    expect(scheduler.batching.size).toEqual(1);
    expect(scheduler.workers.size).toEqual(1);

    scheduler.enqueue(ev);

    const scheduleSpy = jasmine.createSpy().and.callFake(event => worker1Schedule(event));

    scheduler.gotWorker(worker1Id, scheduleSpy);

    expect(scheduler.batching.size).toEqual(0);
    expect(scheduler.workers.size).toEqual(1);

    expect(batch.remaining_enqueues.default).toEqual(0);
    expect(batch.deadline).toEqual(now.getTime() + 10 * 1000);
    // it should be called with undefined if batch is expired
    expect(scheduleSpy).toHaveBeenCalledWith(undefined);

    scheduler.enqueue(ev);

    const movedBatch = scheduler.batching.get(worker2Id);

    expect(movedBatch.remaining_enqueues.default).toEqual(1);
    expect(movedBatch.deadline).toEqual(now.getTime() + 10 * 1000);

    expect(scheduler.batching.size).toEqual(1);
    expect(scheduler.workers.size).toEqual(0);
  });

  it("should use deadline batching, release finished batches and move batch to the next worker", () => {
    const ev = new event.Event({
      target: new event.Target({
        id: "my_target",
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({
          env: [],
          timeout: schedulerOptions.timeout,
          batch: new event.SchedulingContext.Batch({
            limit: 5,
            deadline: 10
          })
        })
      }),
      type: -1
    });

    scheduler.enqueue(ev);
    scheduler.gotWorker(worker1Id, worker1Schedule);

    const batch = scheduler.batching.get(worker1Id);

    expect(batch.remaining_enqueues.default).toEqual(4);
    expect(batch.deadline).toEqual(now.getTime() + 10 * 1000);
    expect(scheduler.batching.size).toEqual(1);
    expect(scheduler.workers.size).toEqual(1);

    clock.tick(11 * 1000);

    scheduler.enqueue(ev);

    const finishedBatch = scheduler.batching.get(worker1Id);
    expect(finishedBatch.remaining_enqueues.default).toEqual(4);
    expect(finishedBatch.deadline).toEqual(Date.now() - 1 * 1000);

    const movedBatch = scheduler.batching.get(worker2Id);
    expect(movedBatch.remaining_enqueues.default).toEqual(4);
    expect(movedBatch.deadline).toEqual(Date.now() + 10 * 1000);

    // it acts different from limit batch
    // it should be 2 until gotworker called and finished batches killed,
    expect(scheduler.batching.size).toEqual(2);
    // it should take a new worker
    expect(scheduler.workers.size).toEqual(0);

    const scheduleSpy = spyOn(scheduler.batching.get(worker1Id), "schedule").and.callThrough();
    scheduler.gotWorker(worker2Id, worker2Schedule);

    // it should be called with undefined if batch is expired
    expect(scheduleSpy).toHaveBeenCalledWith(undefined);
    expect(scheduler.batching.size).toEqual(1);
  });
});
