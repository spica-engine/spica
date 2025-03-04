import {Module} from "@nestjs/common";
import {EnvVarsService} from "./service";
import {EnvVarsController} from "./controller";
import {SchemaModule} from "@spica-server/core/schema";
import EnvVarsSchema from "./schema.json" with {type: "json"};

@Module({})
export class EnvVarsModule {
  static forRoot() {
    return {
      module: EnvVarsModule,
      imports: [
        SchemaModule.forChild({
          schemas: [EnvVarsSchema]
        })
      ],
      controllers: [EnvVarsController],
      providers: [EnvVarsService],
      exports: [EnvVarsService]
    };
  }
}
