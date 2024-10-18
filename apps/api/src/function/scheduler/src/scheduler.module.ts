import {DynamicModule, Module} from "@nestjs/common";
import {Scheduler} from "./scheduler";
import {SchedulingOptions, SCHEDULING_OPTIONS} from "./options";

@Module({})
export class SchedulerModule {
  static forRoot(options: SchedulingOptions): DynamicModule {
    return {
      module: SchedulerModule,
      providers: [
        Scheduler,
        {
          provide: SCHEDULING_OPTIONS,
          useValue: options
        }
      ],
      exports: [Scheduler]
    };
  }
}
