import {DynamicModule, Global, Module} from "@nestjs/common";
import {ActivityService} from "./activity.service";

@Global()
@Module({
  providers: [ActivityService],
  exports: [ActivityService]
})
class CoreActivityServicesModule {}

@Module({})
export class ActivityServicesModule {
  static forRoot(): DynamicModule {
    return {
      module: CoreActivityServicesModule
    };
  }

  static forChild(): DynamicModule {
    return {
      module: ActivityServicesModule
    };
  }
}
