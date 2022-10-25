import {DynamicModule, Inject, Module, Optional} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {Scheduler, SchedulerModule, SchedulingOptions} from "@spica-server/function/scheduler";
import {WebhookModule} from "@spica-server/function/webhook";
import * as path from "path";
import {FunctionEngine} from "./engine";
import {FunctionController} from "./function.controller";
import {LogModule, LogService} from "@spica-server/function/src/log";
import {registerInformers} from "./machinery";
import {
  FunctionOptions,
  FUNCTION_OPTIONS,
  FunctionService,
  ServicesModule
} from "@spica-server/function/services";
import {EnqueuerSchemaResolver, provideEnqueuerSchemaResolver} from "./schema/enqueuer.resolver";
import {Http} from "./services/interface";
import {Axios} from "./services/axios";
import {registerStatusProvider} from "./status";
import FunctionSchema = require("./schema/function.json");
import {
  RegisterSyncProvider,
  REGISTER_SYNC_PROVIDER,
  RepresentativeManager
} from "@spica-server/versioncontrol";
import {getSyncProviders} from "./versioncontrol";
import {registerAssetHandlers} from "./asset";

@Module({})
export class FunctionModule {
  constructor(
    fs: FunctionService,
    fe: FunctionEngine,
    scheduler: Scheduler,
    @Optional() private repManager: RepresentativeManager,
    @Optional() @Inject(REGISTER_SYNC_PROVIDER) registerSync: RegisterSyncProvider,
    logs: LogService,
    validator: Validator
  ) {
    if (registerSync) {
      getSyncProviders(fs, this.repManager, fe, logs).forEach(provider => registerSync(provider));
    }

    registerInformers(fs, fe);

    registerStatusProvider(fs, scheduler);

    registerAssetHandlers(fs, fe, logs, validator);
  }

  static forRoot(options: SchedulingOptions & FunctionOptions): DynamicModule {
    return {
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
          debug: options.debug
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
            entryLimit: options.entryLimit
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
  }
}
