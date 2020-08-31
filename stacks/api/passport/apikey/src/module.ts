import {Module, DynamicModule, Global} from "@nestjs/common";
import {ApiKeyController} from "./apikey.controller";
import {ApiKeyService} from "./apikey.service";
import {ApiKeyStrategy} from "./apikey.strategy";
import {SchemaModule} from "@spica-server/core/schema";

@Global()
@Module({})
export class ApiKeyModule {
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
