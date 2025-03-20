import {Global, Module} from "@nestjs/common";
import {EnvVarsService} from "./service";

@Global()
@Module({})
export class ServicesModule {
  static forRoot() {
    return {
      module: ServicesModule,
      providers: [EnvVarsService],
      exports: [EnvVarsService]
    };
  }
}
