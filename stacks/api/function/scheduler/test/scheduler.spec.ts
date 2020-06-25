import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {Event} from "@spica-server/function/queue/proto";
import {Worker} from "@spica-server/function/runtime";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";
import {PassThrough} from "stream";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5687";
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Scheduler", () => {
  let scheduler: Scheduler;
  let app: INestApplication;
  let spawnSpy: jasmine.Spy;
  let schedulerOptions = {
    databaseUri: undefined,
    databaseName: undefined,
    databaseReplicaSet: undefined,
    poolSize: 10,
    publicUrl: undefined,
    timeout: 60000
  };

  let clock: jasmine.Clock;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), SchedulerModule.forRoot(schedulerOptions)]
    }).compile();

    scheduler = module.get(Scheduler);

    spawnSpy = spyOn(scheduler.runtimes.get("node"), "spawn").and.callThrough();

    app = module.createNestApplication();

    clock = jasmine.clock();
    clock.mockDate(new Date(2015, 1, 1, 1, 1, 31, 0));
    clock.install();

    await app.init();
  });

  const compilation = {
    cwd: undefined,
    entrypoint: "index.ts"
  };

  beforeEach(async () => {
    compilation.cwd = FunctionTestBed.initialize(`export default function() {}`);
    await scheduler.languages.get("typescript").compile(compilation);
  });

  afterEach(() => {
    scheduler.kill();
    app.close();
    clock.uninstall();
  });

  it("should spawn N process", () => {
    expect(spawnSpy).toHaveBeenCalledTimes(10);
  });

  it("should attach outputs when the worker scheduled", () => {
    const event = new Event.Event({
      target: new Event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new Event.SchedulingContext({env: [], timeout: 1000})
      }),
      type: -1
    });
    const [id, worker] = Array.from(scheduler["pool"]).pop() as [string, Worker];
    const attachSpy = spyOn(worker, "attach");
    scheduler["scheduled"](event, id);
    expect(attachSpy).toHaveBeenCalled();
  });

  it("should spawn a new worker when a new message queued", () => {
    expect(spawnSpy).toHaveBeenCalledTimes(10);
    scheduler["schedule"]();
    expect(spawnSpy).toHaveBeenCalledTimes(11);
  });

  it("should kill the worker when the execution times out", () => {
    const event = new Event.Event({
      target: new Event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new Event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1
    });

    const [id, worker] = Array.from(scheduler["pool"]).pop() as [string, Worker];
    scheduler["scheduled"](event, id);
    const kill = spyOn(worker, "kill");
    expect(kill).not.toHaveBeenCalled();
    clock.tick(schedulerOptions.timeout * 1000);
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it("should pick the minimum timeout value when scheduling", () => {
    const event = new Event.Event({
      target: new Event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new Event.SchedulingContext({env: [], timeout: schedulerOptions.timeout * 2})
      }),
      type: -1
    });

    const [id, worker] = Array.from(scheduler["pool"]).pop() as [string, Worker];
    scheduler["scheduled"](event, id);
    const kill = spyOn(worker, "kill");
    expect(kill).not.toHaveBeenCalled();
    clock.tick(schedulerOptions.timeout * 1000);
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it("should write to stderr when the execution of a function times out", () => {
    const event = new Event.Event({
      target: new Event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new Event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1
    });

    const id = scheduler["pool"].keys().next().value;
    const stream = new PassThrough();
    spyOn(scheduler["output"], "create").and.returnValue([stream, stream]);
    scheduler["scheduled"](event, id);

    const write = spyOn(stream, "write");
    expect(write).not.toHaveBeenCalled();
    clock.tick(schedulerOptions.timeout * 1000);
    expect(write).toHaveBeenCalledWith(
      "Function (default) did not finish within 60000 seconds. Aborting."
    );
  });

  it("should not write to stderr when the function quits within the timeout frame", () => {
    const event = new Event.Event({
      target: new Event.Target({
        cwd: compilation.cwd,
        handler: "default",
        context: new Event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1
    });

    const [id, worker] = Array.from(scheduler["pool"]).pop() as [string, Worker];
    const stream = new PassThrough();
    spyOn(scheduler["output"], "create").and.returnValue([stream, stream]);
    scheduler["scheduled"](event, id);
    const write = spyOn(stream, "write");
    expect(write).not.toHaveBeenCalled();
    worker.emit("exit"); /* simulate exit */
    clock.tick(schedulerOptions.timeout * 1000);
    expect(write).not.toHaveBeenCalled();
  });
});
