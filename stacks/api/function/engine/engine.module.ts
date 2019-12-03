import {DynamicModule, Module} from "@nestjs/common";
import {DatabaseService} from "@spica-server/database";
import {FunctionEngine} from "./engine";
import {FunctionExecutor, VM2Executor} from "./executor";
import {FsHost, FunctionHost} from "./host";
import {DatabaseLogger, LoggerHost} from "./logger";
import {DatabaseUnitModule} from "./module/database";
import {EngineRegistry} from "./registry";
import {SubscriptionEngine} from "./subscription/engine";
import {RequestSubscriptionExecutor, SubscriptionExecutor} from "./subscription/executor";
import {DatabaseTriggerModule} from "./trigger/database";
import {FirehoseTriggerModule} from "./trigger/firehose";
import {HttpTriggerModule} from "./trigger/http";
import {ScheduleTriggerModule} from "./trigger/schedule";
import {DashboardUnitModule} from "./module/dashboard";

@Module({})
export class EngineModule {
  static forRoot(options: {root: string}): DynamicModule {
    return {
      module: EngineModule,
      imports: [
        DatabaseUnitModule,
        DashboardUnitModule,
        HttpTriggerModule,
        FirehoseTriggerModule,
        DatabaseTriggerModule,
        ScheduleTriggerModule
      ],
      exports: [EngineRegistry, FunctionEngine, SubscriptionEngine, LoggerHost, FunctionHost],
      providers: [
        EngineRegistry,
        FunctionEngine,
        SubscriptionEngine,
        {provide: LoggerHost, useFactory: db => new DatabaseLogger(db), inject: [DatabaseService]},
        {
          provide: FunctionExecutor,
          useValue: new VM2Executor()
        },
        {
          provide: FunctionHost,
          useValue: new FsHost(options.root)
        },
        {
          provide: SubscriptionExecutor,
          useValue: new RequestSubscriptionExecutor()
        }
      ]
    };
  }
}
