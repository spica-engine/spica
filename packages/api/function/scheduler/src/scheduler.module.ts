import {DynamicModule, Module} from "@nestjs/common";
import {Scheduler} from "./scheduler.js";
import {SchedulingOptions, SCHEDULING_OPTIONS} from "@spica-server/interface-function-scheduler";
import {GuardService} from "@spica-server/passport-guard-services";
import {provideRepository} from "@spica-server/data";
import {FUNCTION_LOG_SINK} from "@spica-server/interface-function-log";

@Module({})
export class SchedulerModule {
  static forRoot(options: SchedulingOptions): DynamicModule {
    return {
      module: SchedulerModule,
      providers: [
        provideRepository(FUNCTION_LOG_SINK),
        Scheduler,
        GuardService,
        {
          provide: SCHEDULING_OPTIONS,
          useValue: options
        }
      ],
      exports: [Scheduler]
    };
  }
}
