import {Global, Module} from "@nestjs/common";
import {ConfigService} from "./config.service.js";
import {ConfigController} from "./config.controller.js";
import {ConfigSchemaRegistry} from "./config.schema.registry.js";
import {REGISTER_CONFIG_SCHEMA} from "@spica-server/interface-config";
import {SchemaModule} from "@spica-server/core-schema";

@Global()
@Module({})
export class ConfigModule {
  static forRoot() {
    return {
      module: ConfigModule,
      imports: [SchemaModule.forChild({})],
      controllers: [ConfigController],
      providers: [
        ConfigService,
        ConfigSchemaRegistry,
        {
          provide: REGISTER_CONFIG_SCHEMA,
          useFactory: (registry: ConfigSchemaRegistry) => {
            return (module: string, optionsSchema: object) => {
              registry.register(module, optionsSchema);
            };
          },
          inject: [ConfigSchemaRegistry]
        }
      ],
      exports: [ConfigService, ConfigSchemaRegistry, REGISTER_CONFIG_SCHEMA]
    };
  }
}
