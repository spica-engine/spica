import {Module, Global, DynamicModule} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {NoopStrategy} from "./noop.strategy";

@Global()
@Module({})
export class PassportTestingModule {
  static initialize(): DynamicModule {
    return {
      module: PassportTestingModule,
      imports: [PassportModule.register({defaultStrategy: "noop", session: false})],
      exports: [PassportModule, NoopStrategy],
      providers: [NoopStrategy]
    };
  }
}
