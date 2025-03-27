import {DynamicModule, Global, Module} from "@nestjs/common";
import {ActivityService} from "./activity.service";
import {ActivityOptions, ACTIVITY_OPTIONS} from "@spica-server/interface/activity";

@Global()
@Module({
  providers: [ActivityService],
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
