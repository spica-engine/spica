import {Module, DynamicModule} from "@nestjs/common";
import {LogController} from "./log.controller";
import {FUNCTION_LOG_OPTIONS, LogOptions} from "./interface";
import {LogGateway} from "./realtime.gateway";
import {RealtimeDatabaseModule} from "@spica-server/database/realtime";
import {LogService} from "./log.service";

@Module({})
export class LogModule {
  static forRoot(options: LogOptions): DynamicModule {
    return {
      module: LogModule,
      imports: [RealtimeDatabaseModule],
      controllers: [LogController],
      providers: [
        LogService,
        LogGateway,
        {
          provide: FUNCTION_LOG_OPTIONS,
          useValue: options
        }
      ]
    };
  }
}
