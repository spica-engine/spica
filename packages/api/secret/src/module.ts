import {DynamicModule, Module} from "@nestjs/common";
import {ServicesModule} from "@spica-server/secret-services";
import {SecretController} from "./controller.js";
import {SchemaModule} from "@spica-server/core/schema";
import SecretSchema from "./schema.json" with {type: "json"};
import {SecretRealtimeModule} from "@spica-server/secret-realtime";

@Module({})
export class SecretModule {
  static forRoot(options: {realtime: boolean; encryptionSecret: string}): DynamicModule {
    const imports = [
      SchemaModule.forChild({
        schemas: [SecretSchema]
      }),
      ServicesModule.forRoot({encryptionSecret: options.encryptionSecret})
    ];

    if (options.realtime) {
      imports.push(SecretRealtimeModule.register());
    }

    return {
      module: SecretModule,
      imports,
      controllers: [SecretController],
      exports: []
    };
  }
}
