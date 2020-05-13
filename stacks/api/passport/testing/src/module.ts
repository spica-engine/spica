import {DynamicModule, Global, Module} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {TestingOptions} from "./interface";
import {NoopStrategy} from "./noop.strategy";

@Global()
@Module({})
export class PassportTestingModule {
  static initialize(options?: TestingOptions): DynamicModule {
    return {
      module: PassportTestingModule,
      imports: [PassportModule.register({defaultStrategy: "noop", session: false})],
      exports: [PassportModule, NoopStrategy],
      providers: [
        {
          provide: NoopStrategy,
          useFactory: () => new NoopStrategy(options || {})
        }
      ]
    };
  }
}
