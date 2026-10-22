import {Module} from "@nestjs/common";
import {
  FunctionOptions,
  FUNCTION_OPTIONS,
  FUNCTION_REPOSITORY
} from "@spica-server/interface-function";
import {provideRepository} from "@spica-server/data";
import {FunctionService} from "./service.js";
import {FUNCTION_ASSET_REPOSITORY} from "@spica-server/interface-function-asset-storage";
import {
  EnvVarService,
  ServicesModule as EnvVarServicesModule
} from "@spica-server/env_var-services";
import {SecretService} from "@spica-server/secret-services";
import {ENV_VAR_REPOSITORY} from "@spica-server/interface-env_var";

@Module({})
export class ServicesModule {
  static forRoot(options: FunctionOptions) {
    return {
      imports: [EnvVarServicesModule],
      module: ServicesModule,
      providers: [
        provideRepository(FUNCTION_REPOSITORY),
        FunctionService,
        provideRepository(FUNCTION_ASSET_REPOSITORY),
        {
          provide: FUNCTION_OPTIONS,
          useValue: options
        },
        provideRepository(ENV_VAR_REPOSITORY),
        EnvVarService
      ],
      exports: [FunctionService, FUNCTION_REPOSITORY, FUNCTION_ASSET_REPOSITORY]
    };
  }
}
