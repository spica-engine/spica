import {Module} from "@nestjs/common";
import {FunctionOptions, FUNCTION_OPTIONS} from "./options";
import {FunctionService} from "./service";
import {
  EnvVarsService,
  ServicesModule as EnvVarsServicesModule
} from "@spica-server/env_var/services";

@Module({})
export class ServicesModule {
  static forRoot(options: FunctionOptions) {
    return {
      imports: [EnvVarsServicesModule],
      module: ServicesModule,
      providers: [
        FunctionService,
        {
          provide: FUNCTION_OPTIONS,
          useValue: options
        },
        EnvVarsService
      ],
      exports: [FunctionService]
    };
  }
}
