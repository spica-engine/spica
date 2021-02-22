import {DynamicModule, Global, Module} from "@nestjs/common";
import {PassportModule as CorePassportModule} from "@nestjs/passport";
import {ApiKeyModule} from "@spica-server/passport/apikey";
import {IdentityModule} from "@spica-server/passport/identity";
import {PolicyModule} from "@spica-server/passport/policy";
import {PreferenceService} from "@spica-server/preference/services";
import {GuardService} from "./guard.service";
import {PassportOptions, PASSPORT_OPTIONS} from "./options";
import {PassportController} from "./passport.controller";
import {SamlService} from "./saml.service";
import {StrategyController} from "./strategy/strategy.controller";
import {StrategyService} from "./strategy/strategy.service";
import {SchemaModule} from "@spica-server/core/schema";
const LoginSchema = require("./schemas/login.json");

@Global()
@Module({})
class PassportCoreModule {
  static initialize(options: PassportOptions): DynamicModule {
    return {
      module: PassportCoreModule,
      imports: [
        CorePassportModule.register({
          defaultStrategy: options.defaultStrategy,
          session: false
        })
      ],
      providers: [GuardService],
      exports: [CorePassportModule, GuardService]
    };
  }
}

@Module({})
export class PassportModule {
  constructor(preference: PreferenceService) {
    preference.default({scope: "passport", identity: {attributes: {}}});
  }

  static forRoot(options: PassportOptions): DynamicModule {
    return {
      module: PassportModule,
      controllers: [PassportController, StrategyController],
      imports: [
        SchemaModule.forChild({
          schemas: [LoginSchema]
        }),
        PassportCoreModule.initialize(options),
        IdentityModule.forRoot({
          expiresIn: options.expiresIn,
          maxExpiresIn: options.maxExpiresIn,
          issuer: options.issuer,
          secretOrKey: options.secretOrKey,
          audience: options.audience,
          defaultIdentityIdentifier: options.defaultIdentityIdentifier,
          defaultIdentityPassword: options.defaultIdentityPassword,
          defaultIdentityPolicies: options.defaultIdentityPolicies,
          identityCountLimit: options.identityCountLimit
        }),
        PolicyModule.forRoot(),
        ApiKeyModule.forRoot()
      ],
      providers: [StrategyService, SamlService, {provide: PASSPORT_OPTIONS, useValue: options}]
    };
  }
}
