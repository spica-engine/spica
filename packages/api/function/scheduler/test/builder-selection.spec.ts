import {Test, TestingModule} from "@nestjs/testing";
import {Scheduler, SchedulerModule} from "@spica-server/function-scheduler";
import {LegacyBuilder} from "@spica-server/function-builder-legacy";
import {RollupBuilder} from "@spica-server/function-builder-rollup";
import {BuilderType, SUPPORTED_LANGUAGES} from "@spica-server/interface-function-builder";
import {DatabaseTestingModule} from "@spica-server/database-testing";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:7913";

describe("Builder selection", () => {
  let module: TestingModule;

  async function createScheduler(builder?: BuilderType) {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.standalone(),
        SchedulerModule.forRoot({
          invocationLogs: false,
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
          maxWarmWorkers: 0,
          debug: false,
          logger: false,
          builder,
          spawnEntrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH,
          tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH,
          rollupWorkerPath: process.env.FUNCTION_ROLLUP_WORKER_PATH
        })
      ]
    }).compile();

    return module.get(Scheduler);
  }

  afterEach(() => module.close());

  it("should build every supported language with the legacy builder by default", async () => {
    const scheduler = await createScheduler();

    for (const language of SUPPORTED_LANGUAGES) {
      expect(scheduler.builders.get(language)).toBeInstanceOf(LegacyBuilder);
    }
  });

  it("should build every supported language with the rollup builder when selected", async () => {
    const scheduler = await createScheduler(BuilderType.Rollup);

    for (const language of SUPPORTED_LANGUAGES) {
      expect(scheduler.builders.get(language)).toBeInstanceOf(RollupBuilder);
    }
  });
});
