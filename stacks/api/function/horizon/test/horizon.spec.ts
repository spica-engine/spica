import {Global, INestApplication, Module} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {ENQUEUER, Horizon, HorizonModule} from "@spica-server/function/horizon";
import {Event} from "@spica-server/function/queue/proto";
import {Worker} from "@spica-server/function/runtime";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:6798";

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

describe("horizon enqueuer factory", () => {
  let module: TestingModule;
  let horizon: Horizon;
  let app: INestApplication;

  let addQueueSpy: jasmine.Spy;
  let addEnqueuerSpy: jasmine.Spy;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.create(),
        HorizonModule.forRoot({
          databaseName: undefined,
          databaseReplicaSet: undefined,
          databaseUri: undefined,
          poolSize: 10,
          publicUrl: ""
        }),
        SpySchedulerModule
      ]
    }).compile();
    app = module.createNestApplication();
    horizon = module.get(Horizon);
    addQueueSpy = spyOn(horizon["queue"], "addQueue");
    addEnqueuerSpy = spyOn(horizon.enqueuers, "add");
    await app.init();
  });

  it("should inject the provided enqueuer and queue", async () => {
    expect(spyScheduler).toHaveBeenCalledTimes(1);
    expect(spyScheduler).toHaveBeenCalledWith(horizon["queue"]);

    expect(addQueueSpy).toHaveBeenCalledTimes(1);
    expect(addQueueSpy).toHaveBeenCalledWith(null);
  });
});

describe("horizon", () => {
  let horizon: Horizon;
  let app: INestApplication;
  let spawnSpy: jasmine.Spy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.create(),
        HorizonModule.forRoot({
          databaseUri: undefined,
          databaseName: undefined,
          databaseReplicaSet: undefined,
          poolSize: 10,
          publicUrl: ""
        })
      ]
    }).compile();

    horizon = module.get(Horizon);

    spawnSpy = spyOn(horizon.runtime, "spawn").and.callThrough();

    app = module.createNestApplication();

    await app.init();
  });

  const compilation = {
    cwd: undefined,
    entrypoint: "index.ts"
  };

  beforeEach(async () => {
    compilation.cwd = FunctionTestBed.initialize(`export default function() {}`);
    await horizon.runtime.compile(compilation);
  });

  afterEach(() => {
    horizon.kill();
    app.close();
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

    const [id, worker] = Array.from(horizon["pool"]).pop() as [string, Worker];
    const attachSpy = spyOn(worker, "attach");
    horizon["scheduled"](event, id);
    expect(attachSpy).toHaveBeenCalled();
  });

  it("should spawn a new worker when a new message queued", () => {
    expect(spawnSpy).toHaveBeenCalledTimes(10);
    horizon["schedule"]();
    expect(spawnSpy).toHaveBeenCalledTimes(11);
  });
});
