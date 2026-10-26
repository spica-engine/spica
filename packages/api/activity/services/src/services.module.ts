import {DynamicModule, Global, Module} from "@nestjs/common";
import {provideRepository} from "@spica-server/data";
import {ActivityService} from "./activity.service.js";
import {
  ActivityOptions,
  ACTIVITY_OPTIONS,
  ACTIVITY_REPOSITORY
} from "@spica-server/interface-activity";

@Global()
@Module({
  providers: [provideRepository(ACTIVITY_REPOSITORY), ActivityService],
  exports: [ActivityService]
})
class CoreActivityServicesModule {}

@Module({})
export class ActivityServicesModule {
  static forRoot(options: ActivityOptions): DynamicModule {
    return {
      module: CoreActivityServicesModule,
      providers: [{provide: ACTIVITY_OPTIONS, useValue: options}]
    };
  }

  static forChild(): DynamicModule {
    return {
      module: ActivityServicesModule
    };
  }
}
