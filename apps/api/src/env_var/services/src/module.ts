import {Global, Module} from "@nestjs/common";
import {EnvVarService} from "./service";

@Global()
@Module({})
export class ServicesModule {
  static forRoot() {
    return {
      module: ServicesModule,
      providers: [EnvVarService],
      exports: [EnvVarService]
    };
  }
}
