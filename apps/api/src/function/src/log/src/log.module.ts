import {Module, DynamicModule} from "@nestjs/common";
import {LogController} from "./log.controller";
import {FUNCTION_LOG_OPTIONS, LogOptions} from "./interface";
import {LogGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica/database";
import {LogService} from "./log.service";

@Module({})
export class LogModule {
  static forRoot(options: LogOptions): DynamicModule {
    const module = {
      module: LogModule,
      imports: [],
      controllers: [LogController],
      providers: [
        LogService,
        {
          provide: FUNCTION_LOG_OPTIONS,
          useValue: options
        }
      ],
      exports: [LogService]
    };

    if (options.realtime) {
      module.imports.push(RealtimeDatabaseModule);
      module.providers.push(LogGateway as any);
    }

    return module;
  }
}
