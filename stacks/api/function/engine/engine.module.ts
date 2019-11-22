import {DynamicModule, Module} from "@nestjs/common";
import {DatabaseService} from "@spica-server/database";
import {FunctionEngine} from "./engine";
import {FunctionExecutor, NodeExecutor} from "./executor";
import {FsHost, FunctionHost} from "./host";
import {DatabaseLogger, LoggerHost} from "./logger";
import {DatabaseUnitModule} from "./module/database";
import {EngineRegistry} from "./registry";
import {DatabaseTriggerModule} from "./trigger/database";
import {FirehoseTriggerModule} from "./trigger/firehose";
import {HttpTriggerModule} from "./trigger/http";
import {ScheduleTriggerModule} from "./trigger/schedule";

@Module({})
export class EngineModule {
  static forRoot(options: {root: string}): DynamicModule {
    return {
      module: EngineModule,
      imports: [
        DatabaseUnitModule,
        HttpTriggerModule,
        FirehoseTriggerModule,
        DatabaseTriggerModule,
        ScheduleTriggerModule
      ],
      exports: [EngineRegistry, FunctionEngine, LoggerHost, FunctionHost],
      providers: [
        EngineRegistry,
        FunctionEngine,
        {provide: LoggerHost, useFactory: db => new DatabaseLogger(db), inject: [DatabaseService]},
        {
          provide: FunctionExecutor,
          useValue: new NodeExecutor()
        },
        {
          provide: FunctionHost,
          useValue: new FsHost(options.root)
        }
      ]
    };
  }
}
