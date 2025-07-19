import {DynamicModule, Inject, Module, Optional} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";
import {SchedulingOptions} from "@spica-server/interface/function/scheduler";
import {WebhookModule} from "@spica-server/function/webhook";
import path from "path";
import {FunctionEngine} from "./engine";
import {FunctionController} from "./function.controller";
import {LogModule, LogService} from "@spica-server/function/log";
import {FunctionService, ServicesModule} from "@spica-server/function/services";
import {EnqueuerSchemaResolver, provideEnqueuerSchemaResolver} from "./schema/enqueuer.resolver";
import {Http} from "./services/interface";
import {Axios} from "./services/axios";
import {registerStatusProvider} from "./status";
import FunctionSchema from "./schema/function.json" with {type: "json"};
import {
  REGISTER_VC_SYNCHRONIZER,
  RegisterVCSynchronizer
} from "@spica-server/interface/versioncontrol";
import {registerAssetHandlers} from "./asset";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";
import {
  Function,
  FunctionOptions,
  FUNCTION_OPTIONS,
  FunctionWithContent
} from "@spica-server/interface/function";
import {getSynchronizers} from "./versioncontrol";
import {FunctionRealtimeModule} from "@spica-server/function/realtime";

@Module({})
export class FunctionModule {
  constructor(
    fs: FunctionService,
    fe: FunctionEngine,
    scheduler: Scheduler,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager,
    @Optional()
    @Inject(REGISTER_VC_SYNCHRONIZER)
    registerVCSynchronizer: RegisterVCSynchronizer<Function | FunctionWithContent>,
    logs: LogService,
    validator: Validator
  ) {
    if (registerVCSynchronizer) {
      getSynchronizers(fs, fe, logs).forEach(synchronizer => registerVCSynchronizer(synchronizer));
    }

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
          spawnEntrypointPath: options.spawnEntrypointPath,
          tsCompilerPath: options.tsCompilerPath
        }),
        ServicesModule.forRoot({
          logExpireAfterSeconds: options.logExpireAfterSeconds,
          path: options.path,
          entryLimit: options.entryLimit,
          realtimeLogs: options.realtimeLogs
        })
      ],
      controllers: [FunctionController],
      providers: [
        FunctionEngine,
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
        }
      ]
    };
    if (options.realtime) {
      module.imports.push(FunctionRealtimeModule.register());
    }
    return module;
  }
}
