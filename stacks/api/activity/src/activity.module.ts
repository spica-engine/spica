import {DynamicModule, Module} from "@nestjs/common";
import {ActivityServicesModule} from "@spica-server/activity/services/src";
import {ActivityController} from "./activity.controller";

@Module({})
export class ActivityModule {
  static forRoot(): DynamicModule {
    return {
      module: ActivityModule,
      imports: [ActivityServicesModule.forRoot()],
      controllers: [ActivityController]
    };
  }
}
