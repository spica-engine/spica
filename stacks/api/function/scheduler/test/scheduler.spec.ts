import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {event} from "@spica-server/function/queue/proto";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";
import {ReplicationTestingModule} from "@spica-server/replication/testing";
import {PassThrough} from "stream";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5687";
process.env.DISABLE_LOGGER = "true";

describe("Scheduler", () => {
  let scheduler: Scheduler;
  let app: INestApplication;
  let spawnSpy: jasmine.Spy;
  let schedulerOptions = {
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
    logger: false
  };

  function freeWorkers() {
    return Array.from(scheduler["workers"].entries()).filter(([_, w]) => !w.target);
  }

  function activatedWorkers() {
    return Array.from(scheduler["workers"].entries()).filter(([_, w]) => w.target);
  }

  function allWorkers() {
    return Array.from(scheduler["workers"].entries());
  }

  const now = new Date(2015, 1, 1, 1, 1, 31, 0);

  let clock: jasmine.Clock;

  const compilation = {
    cwd: undefined,
    entrypoint: "index.js"
  };

  function completeEvent(evId: string) {
    const [workerId] = Array.from(scheduler.workers.entries()).find(
      ([id, worker]) => worker.target.id == evId
    );
    triggerGotWorker(workerId);
  }

  function triggerGotWorker(_id?: string) {
    const [workerId] = Array.from(scheduler.workers.entries()).find(([id, worker]) =>
      _id ? _id == id : !worker.target
    );
    scheduler.gotWorker(workerId, () => {});
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        ReplicationTestingModule.create(),
        SchedulerModule.forRoot(schedulerOptions)
      ]
    }).compile();

    scheduler = module.get(Scheduler);

    const enqueue = scheduler.enqueue;
    scheduler.enqueue = (event: event.Event) => {
      enqueue.bind(scheduler)(event);
      // we need to trigger this method manually
      // this happens automatically in real scenarios
      triggerGotWorker();
    };

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

    triggerGotWorker();
  });

  afterEach(() => {
    scheduler.kill();
    app.close();
    clock.uninstall();
    spawnSpy.calls.reset();
  });

  it("should spawn on module init", () => {
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  });

  it("should not spawn if there is one worker available", () => {
    spawnSpy.calls.reset();
    scheduler["scaleWorkers"]();
    expect(spawnSpy).toHaveBeenCalledTimes(0);
  });

  it("should attach outputs when the event is enqueued", () => {
    const [[id, worker]] = freeWorkers();
    const attachSpy = spyOn(worker, "attach").and.callThrough();

    const ev = new event.Event({
      target: new event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1
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
      type: -1
    });

    scheduler.enqueue(ev);

    expect(allWorkers().length).toEqual(2);
    expect(activatedWorkers().length).toEqual(1);
    expect(freeWorkers().length).toEqual(1);
  });

  it("should kill the worker when the execution is timed out", () => {
    const [[id, worker]] = freeWorkers();
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
      "60 seconds timeout value has been reached for function 'default'. The worker is being shut down."
    );
  });

  it("should pick the minimum timeout value when scheduling", () => {
    const [[id, worker]] = freeWorkers();
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
      type: -1
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
      type: -1
    });

    const ev2 = new event.Event({
      target: new event.Target({
        id: "2",
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1
    });

    scheduler.enqueue(ev1);
    scheduler.enqueue(ev2);

    expect(scheduler.eventQueue.size).toEqual(0);

    expect(allWorkers().length).toEqual(3);

    const activateds = activatedWorkers();
    expect(activatedWorkers().length).toEqual(2);
    expect(activateds[0][1].target.id).toEqual("1");
    expect(activateds[1][1].target.id).toEqual("2");

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
      type: -1
    });

    scheduler.enqueue(ev1);
    scheduler.enqueue(ev1);

    expect(scheduler.eventQueue.size).toEqual(0);

    expect(allWorkers().length).toEqual(3);

    const activateds = activatedWorkers();
    expect(activateds.length).toEqual(2);
    expect(activateds.every(([_, worker]) => worker.target.id == "1")).toBeTrue();

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
      type: -1
    });

    scheduler.enqueue(ev1);
    scheduler.enqueue(ev1);
    scheduler.enqueue(ev1);

    // waiting for an available worker
    expect(scheduler.eventQueue.size).toEqual(1);

    expect(allWorkers().length).toEqual(3);

    let activateds = activatedWorkers();
    expect(activateds.length).toEqual(2);
    expect(activateds.every(([_, worker]) => worker.target.id == "1")).toBeTrue();

    expect(freeWorkers().length).toEqual(1);

    // lets complete one of these events
    completeEvent("1");

    expect(scheduler.eventQueue.size).toEqual(0);

    expect(allWorkers().length).toEqual(3);

    activateds = activatedWorkers();
    expect(activateds.length).toEqual(2);
    expect(activateds.every(([_, worker]) => worker.target.id == "1")).toBeTrue();

    expect(freeWorkers().length).toEqual(1);
  });
});
