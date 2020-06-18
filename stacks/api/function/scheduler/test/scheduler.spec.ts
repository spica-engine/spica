import {Global, INestApplication, Module} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {ENQUEUER, Scheduler, SchedulerModule} from "@spica-server/function/scheduler";
import {Event} from "@spica-server/function/queue/proto";
import {Worker} from "@spica-server/function/runtime";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:7910";
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

const spyScheduler = jasmine
  .createSpy("schedulerSpy")
  .and.returnValue({enqueuer: null, queue: null});

@Global()
@Module({
  providers: [
    {
      provide: ENQUEUER,
      useValue: spyScheduler
    }
  ],
  exports: [ENQUEUER]
})
export class SpySchedulerModule {}

describe("scheduler enqueuer factory", () => {
  let module: TestingModule;
  let scheduler: Scheduler;
  let app: INestApplication;

  let addQueueSpy: jasmine.Spy;
  let addEnqueuerSpy: jasmine.Spy;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.create(),
        SchedulerModule.forRoot({
          databaseName: undefined,
          databaseReplicaSet: undefined,
          databaseUri: undefined,
          poolSize: 10,
          publicUrl: undefined,
          timeout: 60000
        }),
        SpySchedulerModule
      ]
    }).compile();
    app = module.createNestApplication();
    scheduler = module.get(Scheduler);
    addQueueSpy = spyOn(scheduler["queue"], "addQueue");
    addEnqueuerSpy = spyOn(scheduler.enqueuers, "add");
    await app.init();
  });

  it("should inject the provided enqueuer and queue", async () => {
    expect(spyScheduler).toHaveBeenCalledTimes(1);
    expect(spyScheduler).toHaveBeenCalledWith(scheduler["queue"]);

    expect(addQueueSpy).toHaveBeenCalledTimes(1);
    expect(addQueueSpy).toHaveBeenCalledWith(null);
  });
});

describe("scheduler", () => {
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
      imports: [DatabaseTestingModule.create(), SchedulerModule.forRoot(schedulerOptions)]
    }).compile();

    scheduler = module.get(Scheduler);

    spawnSpy = spyOn(scheduler.runtime, "spawn").and.callThrough();

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
    await scheduler.runtime.compile(compilation);
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
        handler: "default"
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

  it("should kill worker when timeout expired", () => {
    const event = new Event.Event({
      target: new Event.Target({
        cwd: compilation.cwd,
        handler: "default"
      }),
      type: -1
    });

    const [id, worker] = Array.from(scheduler["pool"]).pop() as [string, Worker];
    const killSpy = spyOn(worker, "kill");
    scheduler["scheduled"](event, id);

    expect(killSpy).not.toHaveBeenCalled();

    clock.tick(schedulerOptions.timeout);

    expect(killSpy).toHaveBeenCalledTimes(1);
  });
});
