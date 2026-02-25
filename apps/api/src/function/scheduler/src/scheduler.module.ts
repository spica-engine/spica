import {DynamicModule, Module} from "@nestjs/common";
import {Scheduler} from "./scheduler";
import {SchedulingOptions, SCHEDULING_OPTIONS} from "@spica-server/interface/function/scheduler";
import {GuardService} from "@spica-server/passport/guard/services";

@Module({})
export class SchedulerModule {
  static forRoot(options: SchedulingOptions): DynamicModule {
    return {
      module: SchedulerModule,
      providers: [
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
