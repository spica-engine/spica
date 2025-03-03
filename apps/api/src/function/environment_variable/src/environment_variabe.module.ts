import {Module} from "@nestjs/common";
import {EnvironmentVariableService} from "./environment_variabe.service";
import {EnvironmentVariableController} from "./environment_variable.controller";

@Module({})
export class EnvironmentVariableModule {
  static forRoot() {
    return {
      module: EnvironmentVariableModule,
      controllers: [EnvironmentVariableController],
      providers: [EnvironmentVariableService],
      exports: [EnvironmentVariableService]
    };
  }
}
