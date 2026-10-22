import {DynamicModule, Global, Inject, Module, Optional} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core-schema";
import {ApiKeyController} from "./apikey.controller.js";
import {ApiKeyStrategy} from "./apikey.strategy.js";
import {APIKEY_POLICY_FINALIZER} from "@spica-server/interface-passport-policy";
import {APIKEY_REPOSITORY, ApiKeyRepository} from "@spica-server/interface-passport-apikey";
import {provideRepository} from "@spica-server/data";
import {providePolicyFinalizer} from "./utility.js";
import ApiKeySchema from "./schemas/apikey.json" with {type: "json"};
import {ASSET_REP_MANAGER} from "@spica-server/interface-asset";
import {IRepresentativeManager} from "@spica-server/interface-representative";
import {registerAssetHandlers} from "./asset.js";
import {ApikeyRealtimeModule} from "@spica-server/passport-apikey-realtime";

@Global()
@Module({})
export class ApiKeyModule {
  constructor(
    @Inject(APIKEY_REPOSITORY) apiKeys: ApiKeyRepository,
    validator: Validator,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager
  ) {
    registerAssetHandlers(apiKeys, validator, assetRepManager);
  }
  static forRoot({realtime}): DynamicModule {
    const module: DynamicModule = {
      module: ApiKeyModule,
      imports: [
        SchemaModule.forChild({
          schemas: [ApiKeySchema]
        })
      ],
      exports: [APIKEY_POLICY_FINALIZER],
      controllers: [ApiKeyController],
      providers: [
        provideRepository(APIKEY_REPOSITORY),
        ApiKeyStrategy,
        {
          provide: APIKEY_POLICY_FINALIZER,
          useFactory: providePolicyFinalizer,
          inject: [APIKEY_REPOSITORY]
        }
      ]
    };

    if (realtime) {
      module.imports.push(ApikeyRealtimeModule.register());
    }

    return module;
  }
}
