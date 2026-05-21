import {DynamicModule, Module} from "@nestjs/common";
import {
  FunctionAssetStorageOptions,
  FUNCTION_ASSET_STORAGE_OPTIONS,
  FUNCTION_ASSET_STRATEGY
} from "@spica-server/interface-function-asset-storage";
import {DefaultStrategy} from "./strategy/default.js";
import {AWSS3Strategy} from "./strategy/awss3.js";
import {GCSStrategy} from "./strategy/gcs.js";

@Module({})
export class FunctionAssetStorageModule {
  static forRoot(options: FunctionAssetStorageOptions): DynamicModule {
    return {
      module: FunctionAssetStorageModule,
      providers: [
        {
          provide: FUNCTION_ASSET_STORAGE_OPTIONS,
          useValue: options
        },
        {
          provide: FUNCTION_ASSET_STRATEGY,
          useFactory: (opts: FunctionAssetStorageOptions) => {
            switch (opts.strategy) {
              case "awss3":
                return new AWSS3Strategy(opts.awss3CredentialsPath, opts.awss3BucketName);
              case "gcs":
                return new GCSStrategy(opts.gcsServiceAccountPath, opts.gcsBucketName);
              case "default":
                return new DefaultStrategy(opts.defaultPath);
              default:
                throw new Error(
                  `Unknown function asset storage strategy: ${(opts as any).strategy}`
                );
            }
          },
          inject: [FUNCTION_ASSET_STORAGE_OPTIONS]
        }
      ],
      exports: [FUNCTION_ASSET_STRATEGY, FUNCTION_ASSET_STORAGE_OPTIONS]
    };
  }
}
