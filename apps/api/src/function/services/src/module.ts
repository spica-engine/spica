import {Module} from "@nestjs/common";
import {FunctionOptions, FUNCTION_OPTIONS} from "@spica-server/interface/function/services";
import {FunctionService} from "./service";
import {
  EnvVarService,
  ServicesModule as EnvVarServicesModule
} from "@spica-server/env_var/services";

@Module({})
export class ServicesModule {
  static forRoot(options: FunctionOptions) {
    return {
      imports: [EnvVarServicesModule],
      module: ServicesModule,
      providers: [
        FunctionService,
        {
          provide: FUNCTION_OPTIONS,
          useValue: options
        },
        EnvVarService
      ],
      exports: [FunctionService]
    };
  }
}
