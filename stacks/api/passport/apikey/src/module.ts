import {DynamicModule, Global, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {ApiKeyController} from "./apikey.controller";
import {ApiKeyService} from "./apikey.service";
import {ApiKeyStrategy} from "./apikey.strategy";
import {registerInformers} from "./machinery";
import {APIKEY_POLICY_FINALIZER} from "@spica-server/passport/policy";
import {providePolicyFinalizer} from "./utility";
import ApiKeySchema = require("./schemas/apikey.json");

@Global()
@Module({})
export class ApiKeyModule {
  constructor(apiKeyService: ApiKeyService) {
    registerInformers(apiKeyService);
  }
  static forRoot(): DynamicModule {
    return {
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
  }
}
