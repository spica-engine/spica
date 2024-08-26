import {Global, INestApplication, Module} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {ENQUEUER, Scheduler, SchedulerModule} from "@spica-server/function/scheduler";
import {DatabaseTestingModule} from "@spica-server/database/testing";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:7911";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

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

describe("Scheduler Injection", () => {
  let module: TestingModule;
  let scheduler: Scheduler;
  let app: INestApplication;

  let addQueueSpy: jasmine.Spy;
  let addEnqueuerSpy: jasmine.Spy;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        SchedulerModule.forRoot({
          databaseName: undefined,
          databaseReplicaSet: undefined,
          databaseUri: undefined,
          apiUrl: undefined,
          timeout: 5,
          corsOptions: {
            allowCredentials: true,
            allowedHeaders: ["*"],
            allowedMethods: ["*"],
            allowedOrigins: ["*"]
          },
          maxConcurrency: 1,
          debug: false,
          logger: false
        }),
        SpySchedulerModule
      ]
    }).compile();
    app = module.createNestApplication();
    scheduler = module.get(Scheduler);
    addQueueSpy = spyOn(scheduler["queue"], "addQueue");
    addEnqueuerSpy = spyOn(scheduler.enqueuers, "add");
  });

  afterEach(() => module.close());

  it("should inject the provided enqueuer and queue", async () => {
    await app.init();
    expect(spyScheduler).toHaveBeenCalledTimes(1);
    expect(spyScheduler).toHaveBeenCalledWith(scheduler["queue"], undefined, undefined);

    expect(addQueueSpy).toHaveBeenCalledTimes(1);
    expect(addQueueSpy).toHaveBeenCalledWith(null);
  });
});
