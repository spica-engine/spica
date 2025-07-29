import {DynamicModule, Global, Inject, Module, Optional} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {ApiKeyController} from "./apikey.controller";
import {ApiKeyService} from "./apikey.service";
import {ApiKeyStrategy} from "./apikey.strategy";
import {APIKEY_POLICY_FINALIZER} from "@spica-server/interface/passport/policy";
import {providePolicyFinalizer} from "./utility";
import ApiKeySchema from "./schemas/apikey.json" with {type: "json"};
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {registerAssetHandlers} from "./asset";
import {ApikeyRealtimeModule} from "../realtime";

@Global()
@Module({})
export class ApiKeyModule {
  constructor(
    as: ApiKeyService,
    validator: Validator,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager
  ) {
    registerAssetHandlers(as, validator, assetRepManager);
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
        ApiKeyService,
        ApiKeyStrategy,
        {
          provide: APIKEY_POLICY_FINALIZER,
          useFactory: providePolicyFinalizer,
          inject: [ApiKeyService]
        }
      ]
    };

    if (realtime) {
      module.imports.push(ApikeyRealtimeModule.register());
    }

    return module;
  }
}
