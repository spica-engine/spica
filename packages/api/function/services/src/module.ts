import {Module} from "@nestjs/common";
import {
  FunctionOptions,
  FUNCTION_OPTIONS,
  FUNCTION_REPOSITORY
} from "@spica-server/interface-function";
import {provideRepository} from "@spica-server/data";
import {FunctionService} from "./service.js";
import {FunctionAssetService} from "./asset.service.js";
import {
  EnvVarService,
  ServicesModule as EnvVarServicesModule
} from "@spica-server/env_var-services";
import {SecretService} from "@spica-server/secret-services";

@Module({})
export class ServicesModule {
  static forRoot(options: FunctionOptions) {
    return {
      imports: [EnvVarServicesModule],
      module: ServicesModule,
      providers: [
        provideRepository(FUNCTION_REPOSITORY),
        FunctionService,
        FunctionAssetService,
        {
          provide: FUNCTION_OPTIONS,
          useValue: options
        },
        EnvVarService
      ],
      exports: [FunctionService, FUNCTION_REPOSITORY, FunctionAssetService]
    };
  }
}
