import {Module} from "@nestjs/common";
import {EnvironmentVariableService} from "./service";
import {EnvironmentVariableController} from "./controller";
import {SchemaModule} from "@spica-server/core/schema";
import EnvironmentVariableSchema from "./schema.json" with {type: "json"};

@Module({})
export class EnvironmentVariableModule {
  static forRoot() {
    return {
      module: EnvironmentVariableModule,
      imports: [
        SchemaModule.forChild({
          schemas: [EnvironmentVariableSchema]
        })
      ],
      controllers: [EnvironmentVariableController],
      providers: [EnvironmentVariableService],
      exports: [EnvironmentVariableService]
    };
  }
}
