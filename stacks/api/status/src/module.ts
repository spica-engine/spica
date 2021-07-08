import {Global, Module, DynamicModule} from "@nestjs/common";
import {StatusController} from "./controller";

@Module({})
export class StatusModule {
  static forRoot(): DynamicModule {
    return {
      module: StatusModule,
      controllers: [StatusController]
    };
  }
}
