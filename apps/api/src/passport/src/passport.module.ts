import {DynamicModule, Global, Module} from "@nestjs/common";
import {PassportModule as CorePassportModule} from "@nestjs/passport";
import {ApiKeyModule} from "@spica/api/src/passport/apikey";
import {IdentityModule} from "@spica/api/src/passport/identity";
import {PolicyModule} from "@spica/api/src/passport/policy";
import {PreferenceService} from "@spica/api/src/preference/services";
import {GuardService} from "./guard.service";
import {
  PassportOptions,
  PASSPORT_OPTIONS,
  RequestService,
  REQUEST_SERVICE,
  STRATEGIES
} from "./options";
import {PassportController} from "./passport.controller";
import {SamlService} from "./strategy/services/saml.service";
import {StrategyController} from "./strategy/strategy.controller";
import {StrategyService} from "./strategy/services/strategy.service";
import {SchemaModule} from "@spica/core";
import {OAuthService} from "./strategy/services/oauth.service";
import {AuthFactorModule} from "@spica/api/src/passport/authfactor";
import LoginSchema = require("./schemas/login.json");
import StrategySchema = require("./schemas/strategy.json");

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
          schemas: [LoginSchema, StrategySchema]
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
          entryLimit: options.entryLimit
        }),
        PolicyModule.forRoot(),
        ApiKeyModule.forRoot(),
        AuthFactorModule
      ],
      providers: [
        {
          provide: REQUEST_SERVICE,
          useClass: RequestService
        },
        StrategyService,
        {
          provide: STRATEGIES,
          useFactory: (ser, ops, req) => {
            const strategies = [new OAuthService(ser, ops, req), new SamlService(ser, ops)];
            return {
              find: (type: string) => strategies.find(s => s.type == type)
            };
          },
          inject: [StrategyService, PASSPORT_OPTIONS, REQUEST_SERVICE]
        },
        {provide: PASSPORT_OPTIONS, useValue: options}
      ]
    };
  }
}
