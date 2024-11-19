import {DynamicModule, Module} from "@nestjs/common";
import {ActivityServicesModule, ActivityOptions} from "@spica/api/src/activity/services";
import {ActivityController} from "./activity.controller";

@Module({})
export class ActivityModule {
  static forRoot(options: ActivityOptions): DynamicModule {
    return {
      module: ActivityModule,
      imports: [ActivityServicesModule.forRoot(options)],
      controllers: [ActivityController]
    };
  }
}
