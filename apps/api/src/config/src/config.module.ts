import {Global, Module} from "@nestjs/common";
import {ConfigService} from "./config.service";
import {ConfigController} from "./config.controller";
import {SchemaModule} from "@spica-server/core/schema";
import ConfigSchema from "./schemas/config.json" with {type: "json"};

@Global()
@Module({})
export class ConfigModule {
  static forRoot() {
    return {
      module: ConfigModule,
      imports: [
        SchemaModule.forChild({
          schemas: [ConfigSchema]
        })
      ],
      controllers: [ConfigController],
      providers: [ConfigService],
      exports: [ConfigService]
    };
  }
}
