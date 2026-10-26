import {Module} from "@nestjs/common";
import {FunctionOptions, FUNCTION_OPTIONS} from "@spica-server/interface-function";
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
        FunctionService,
        FunctionAssetService,
        {
          provide: FUNCTION_OPTIONS,
          useValue: options
        },
        EnvVarService
      ],
      exports: [FunctionService, FunctionAssetService]
    };
  }
}
