import {DynamicModule, Global, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {ApiKeyController} from "./apikey.controller";
import {ApiKeyService} from "./apikey.service";
import {ApiKeyStrategy} from "./apikey.strategy";
import {registerInformers} from "./machinery";

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
          schemas: [require(`./schemas/apikey.json`)]
        })
      ],
      controllers: [ApiKeyController],
      providers: [ApiKeyService, ApiKeyStrategy]
    };
  }
}
