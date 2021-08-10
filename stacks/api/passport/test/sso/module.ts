import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {IdentityModule} from "@spica-server/passport/identity";
import {PolicyModule} from "@spica-server/passport/policy";
import {PassportOptions, PASSPORT_OPTIONS} from "@spica-server/passport/src/options";
import {PassportController} from "@spica-server/passport/src/passport.controller";
import {OAuthService} from "@spica-server/passport/src/strategy/services/oauth.service";
import {SamlService} from "@spica-server/passport/src/strategy/services/saml.service";
import {StrategyService} from "@spica-server/passport/src/strategy/services/strategy.service";
import {StrategyController} from "@spica-server/passport/src/strategy/strategy.controller";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

@Module({})
export class SSOTestingModule {
  static initialize(options: PassportOptions): DynamicModule {
    return {
      module: SSOTestingModule,
      controllers: [PassportController, StrategyController],
      imports: [
        SchemaModule.forChild(),
        IdentityModule.forRoot(options),
        PolicyModule.forRoot(),
        PreferenceTestingModule
      ],
      providers: [
        StrategyService,
        SamlService,
        OAuthService,
        {provide: PASSPORT_OPTIONS, useValue: options}
      ]
    };
  }
}
