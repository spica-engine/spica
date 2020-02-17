import {Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {Horizon, HorizonModule} from "@spica-server/function/horizon";
import {Event} from "@spica-server/function/queue/proto";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import {INestApplication, Global, Module} from "@nestjs/common";
import {Scheduler} from "../src";
import {SCHEDULER} from "../src/scheduler";

const provideScheduler: Scheduler<unknown, unknown> = () => {
  return {
    enqueuer: null,
    queue: null
  };
};

@Global()
@Module({
  providers: [
    {
      provide: SCHEDULER,
      useValue: provideScheduler
    }
  ],
  exports: [SCHEDULER]
})
export class MockProviderModule {}

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

  describe("adding queue and enqueuer", () => {
    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.create(), HorizonModule, MockProviderModule]
      }).compile();

      horizon = module.get(Horizon);

      app = module.createNestApplication();

      await app.init();
    });

    afterEach(() => {});

    it("should inject provided scheduler", () => {});
  });
});
