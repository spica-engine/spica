import {Global, Module} from "@nestjs/common";
import {ConfigService} from "./config.service";
import {ConfigController} from "./config.controller";

@Global()
@Module({})
export class ConfigModule {
  static forRoot() {
    return {
      module: ConfigModule,
      controllers: [ConfigController],
      providers: [ConfigService],
      exports: [ConfigService]
    };
  }
}
