import {DynamicModule, Module} from "@nestjs/common";
import {ActivityOptions} from "@spica-server/interface/activity";
import {ActivityController} from "./activity.controller";
import {ActivityServicesModule} from "@spica-server/activity/services";

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
