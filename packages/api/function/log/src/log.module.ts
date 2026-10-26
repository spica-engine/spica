import {Module, DynamicModule} from "@nestjs/common";
import {LogController} from "./log.controller.js";
import {
  FUNCTION_LOG_OPTIONS,
  FUNCTION_LOG_REPOSITORY,
  LogOptions
} from "@spica-server/interface-function-log";
import {provideRepository} from "@spica-server/data";
import {LogGateway} from "./realtime.gateway.js";
import {RealtimeDatabaseModule} from "@spica-server/database-realtime";

@Module({})
export class LogModule {
  static forRoot(options: LogOptions): DynamicModule {
    const module = {
      module: LogModule,
      imports: [],
      controllers: [LogController],
      providers: [
        provideRepository(FUNCTION_LOG_REPOSITORY),
        {
          provide: FUNCTION_LOG_OPTIONS,
          useValue: options
        }
      ],
      exports: [FUNCTION_LOG_REPOSITORY]
    };

    if (options.realtime) {
      module.imports.push(RealtimeDatabaseModule);
      module.providers.push(LogGateway as any);
    }

    return module;
  }
}
