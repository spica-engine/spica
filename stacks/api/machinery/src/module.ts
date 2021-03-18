import {Global, Module, DynamicModule} from "@nestjs/common";
import {ApiMachineryController, ApiMachineryObjectController} from "./controller";

@Global()
@Module({})
export class ApiMachineryModule {
  static forRoot(): DynamicModule {
    return {
      module: ApiMachineryModule,
      controllers: [ApiMachineryObjectController, ApiMachineryController]
    };
  }
}
