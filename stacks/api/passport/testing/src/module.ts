import {DynamicModule, Global, Module} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {ActionGuardService, AuthGuardService} from "@spica-server/passport";
import {TestingOptions} from "./interface";
import {NoopStrategy} from "./noop.strategy";

@Global()
@Module({})
export class PassportTestingModule {
  static initialize(options?: TestingOptions): DynamicModule {
    options = options || {};
    options.skipActionCheck = options.skipActionCheck == undefined ? true : options.skipActionCheck;
    options.allowAllResources =
      options.allowAllResources == undefined ? true : options.allowAllResources;
    return {
      module: PassportTestingModule,
      imports: [PassportModule.register({defaultStrategy: "noop", session: false})],
      exports: [PassportModule, NoopStrategy, AuthGuardService, ActionGuardService],
      providers: [
        {
          provide: NoopStrategy,
          useFactory: () => new NoopStrategy(options || {})
        },
        AuthGuardService,
        ActionGuardService
      ]
    };
  }
}
