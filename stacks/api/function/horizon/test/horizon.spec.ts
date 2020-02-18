import {Global, INestApplication, Module} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {Horizon, HorizonModule, SCHEDULER} from "@spica-server/function/horizon";
import {Event} from "@spica-server/function/queue/proto";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";

const spyScheduler = jasmine
  .createSpy("schedulerSpy")
  .and.returnValue({enqueuer: null, queue: null});

@Global()
@Module({
  providers: [
    {
      provide: SCHEDULER,
      useValue: spyScheduler
    }
  ],
  exports: [SCHEDULER]
})
export class SpySchedulerModule {}

describe("adding queue and enqueuer", () => {
  let module: TestingModule;
  let horizon: Horizon;
  let app: INestApplication;

  let addQueueSpy: jasmine.Spy;
  let addEnqueuerSpy: jasmine.Spy;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create(), HorizonModule, SpySchedulerModule]
    }).compile();
    app = module.createNestApplication();
    horizon = module.get(Horizon);
    addQueueSpy = spyOn(horizon["queue"], "addQueue");
    addEnqueuerSpy = spyOn(horizon.enqueuers, "add");
    await app.init();
  });

  it("should inject provided scheduler", async () => {
    expect(spyScheduler).toHaveBeenCalledTimes(1);
    expect(spyScheduler).toHaveBeenCalledWith(horizon["queue"]);

    expect(addQueueSpy).toHaveBeenCalledTimes(1);
    expect(addQueueSpy).toHaveBeenCalledWith(null);

    const addingSchedulerEnqueuerCall = addEnqueuerSpy.calls
      .all()
      .filter(call => call.args[0] == null);
    expect(addingSchedulerEnqueuerCall.length).toEqual(1);
  });
});

describe("horizon", () => {
  let horizon: Horizon;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create(), HorizonModule]
    }).compile();

    horizon = module.get(Horizon);

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    horizon.kill();
  });

  it("should create horizon", () => {
    expect(horizon).toBeTruthy();
  });

  describe("runtime", () => {
    const compilation = {
      cwd: undefined,
      entrypoint: "index.ts"
    };

    beforeEach(async () => {
      compilation.cwd = FunctionTestBed.initialize(`export default function() {}`);
      await horizon.runtime.compile(compilation);
    });

    it("should execute", () => {
      const event = new Event.Event();
      const target = new Event.Target();
      target.handler = "default";
      target.cwd = compilation.cwd;
      event.type = Event.Type.HTTP;
      event.target = target;
      horizon["enqueue"](event);
    });
  });
});
