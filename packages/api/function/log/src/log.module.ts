import {Module, DynamicModule} from "@nestjs/common";
import {LogController} from "./log.controller.js";
import {FUNCTION_LOG_OPTIONS, LogOptions} from "@spica-server/interface/function/log";
import {LogGateway} from "./realtime.gateway.js";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";
import {LogService} from "./log.service.js";

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
