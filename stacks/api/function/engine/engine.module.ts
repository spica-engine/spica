import {DynamicModule, Module} from "@nestjs/common";
import {FunctionEngine} from "./engine";
import {FunctionExecutor, IsolatedVMExecutor} from "./executor";
import {FsHost, FunctionHost} from "./host";
import {LoggerHost, WinstonLogger} from "./logger";
import {EngineRegistry} from "./registry";
import {SubscriptionEngine} from "./subscription/engine";
import {RequestSubscriptionExecutor, SubscriptionExecutor} from "./subscription/executor";
import {DatabaseTriggerModule} from "./trigger/database";
import {HttpTriggerModule} from "./trigger/http";
import {ScheduleTriggerModule} from "./trigger/schedule";
import {DatabaseUnitModule} from "./module/database";

@Module({})
export class EngineModule {
  static forRoot(options: {root: string}): DynamicModule {
    return {
      module: EngineModule,
      imports: [
        DatabaseUnitModule,
        HttpTriggerModule,
        DatabaseTriggerModule,
        ScheduleTriggerModule
      ],
      exports: [EngineRegistry, FunctionEngine, SubscriptionEngine, LoggerHost, FunctionHost],
      providers: [
        EngineRegistry,
        FunctionEngine,
        SubscriptionEngine,
        {provide: LoggerHost, useValue: new WinstonLogger(options.root)},
        {
          provide: FunctionExecutor,
          useValue: new IsolatedVMExecutor()
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
