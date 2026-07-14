import {DynamicModule, Inject, Module, Optional} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core-schema";
import {Scheduler, SchedulerModule} from "@spica-server/function-scheduler";
import {SchedulingOptions} from "@spica-server/interface-function-scheduler";
import {WebhookModule} from "@spica-server/function-webhook";
import path from "path";
import {FunctionEngine} from "./engine.js";
import {PlanExecutor} from "./plan-executor.js";
import {FunctionController} from "./function.controller.js";
import {LogModule, LogService} from "@spica-server/function-log";
import {FunctionService, ServicesModule} from "@spica-server/function-services";
import {EnqueuerSchemaResolver, provideEnqueuerSchemaResolver} from "./schema/enqueuer.resolver.js";
import {Http} from "./services/interface.js";
import {Axios} from "./services/axios.js";
import {registerStatusProvider} from "./status.js";
import FunctionSchema from "./schema/function.json" with {type: "json"};
import {registerAssetHandlers} from "./asset.js";
import {IRepresentativeManager} from "@spica-server/interface-representative";
import {ASSET_REP_MANAGER} from "@spica-server/interface-asset";
import {FunctionOptions, FUNCTION_OPTIONS} from "@spica-server/interface-function";
import {FunctionRealtimeModule} from "@spica-server/function-realtime";
import {FunctionAssetStorageModule} from "@spica-server/function-asset-storage";
import {FunctionAssetReconciler} from "./asset-reconciler.js";
import {FunctionAssetWatcher} from "./asset-watcher.js";
import {SelfWriteTracker} from "./asset-write-tracker.js";
import {FunctionPreparationService} from "./function-preparation.service.js";

@Module({})
export class FunctionModule {
  constructor(
    fs: FunctionService,
    fe: FunctionEngine,
    scheduler: Scheduler,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager,
    logs: LogService,
    validator: Validator
  ) {
    registerStatusProvider(fs, scheduler);
    registerAssetHandlers(fs, fe, logs, validator, this.assetRepManager);
  }
  static forRoot(
    options: SchedulingOptions & FunctionOptions & {realtime: boolean}
  ): DynamicModule {
    const module: DynamicModule = {
      module: FunctionModule,
      imports: [
        LogModule.forRoot({
          expireAfterSeconds: options.logExpireAfterSeconds,
          realtime: options.realtimeLogs
        }),
        SchemaModule.forChild({
          schemas: [FunctionSchema],
          customFields: ["viewEnum"]
        }),
        WebhookModule.forRoot({expireAfterSeconds: options.logExpireAfterSeconds}),
        SchedulerModule.forRoot({
          maxConcurrency: options.maxConcurrency,
          eventConcurrency: options.eventConcurrency,
          maxWarmWorkers: options.maxWarmWorkers,
          functionWorkerCutoverGraceMs: options.functionWorkerCutoverGraceMs,
          databaseName: options.databaseName,
          databaseReplicaSet: options.databaseReplicaSet,
          databaseUri: options.databaseUri,
          apiUrl: options.apiUrl,
          timeout: options.timeout,
          experimentalDevkitDatabaseCache: options.experimentalDevkitDatabaseCache,
          corsOptions: options.corsOptions,
          debug: options.debug,
          logger: options.logger,
          invocationLogs: options.invocationLogs,
          workerLogOutput: options.workerLogOutput,
          spawnEntrypointPath: options.spawnEntrypointPath,
          tsCompilerPath: options.tsCompilerPath,
          grpcPort: options.grpcPort,
          functionGrpcMaxMessageSizeBytes: options.functionGrpcMaxMessageSizeBytes,
          payloadSizeLimit: options.payloadSizeLimit
        }),
        ServicesModule.forRoot({
          logExpireAfterSeconds: options.logExpireAfterSeconds,
          path: options.path,
          entryLimit: options.entryLimit,
          realtimeLogs: options.realtimeLogs,
          assetStorage: options.assetStorage
        }),
        FunctionAssetStorageModule.forRoot(options.assetStorage)
      ],
      controllers: [FunctionController],
      providers: [
        FunctionEngine,
        PlanExecutor,
        {
          provide: FUNCTION_OPTIONS,
          useValue: {
            root: path.join(options.path, "functions"),
            timeout: options.timeout,
            entryLimit: options.entryLimit,
            outDir: ".build"
          }
        },
        {
          provide: EnqueuerSchemaResolver,
          useFactory: provideEnqueuerSchemaResolver,
          inject: [Validator, FunctionEngine]
        },
        {
          provide: Http,
          useClass: Axios
        },
        FunctionAssetReconciler,
        FunctionAssetWatcher,
        SelfWriteTracker,
        FunctionPreparationService
      ]
    };

    if (options.realtime) {
      module.imports.push(FunctionRealtimeModule.register());
    }
    return module;
  }
}
