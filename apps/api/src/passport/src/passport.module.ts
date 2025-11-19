import {DynamicModule, Global, Module} from "@nestjs/common";
import {PassportModule as CorePassportModule} from "@nestjs/passport";
import {ApiKeyModule} from "@spica-server/passport/apikey";
import {IdentityModule} from "@spica-server/passport/identity";
import {IdentityOptions} from "@spica-server/interface/passport/identity";
import {UserModule} from "@spica-server/passport/user";
import {PolicyModule} from "@spica-server/passport/policy";
import {PreferenceService} from "@spica-server/preference/services";
import {GuardService} from "@spica-server/passport/guard/services";
import {RequestService} from "./options";
import {
  PassportOptions,
  PASSPORT_OPTIONS,
  REQUEST_SERVICE,
  STRATEGIES
} from "@spica-server/interface/passport";
import {PassportIdentityController} from "./passport.identity.controller";
import {PassportUserController} from "./passport.user.controller";
import {SamlService} from "./strategy/services/saml.service";
import {StrategyController} from "./strategy/strategy.controller";
import {StrategyService} from "./strategy/services/strategy.service";
import {SchemaModule} from "@spica-server/core/schema";
import {initializeOAuthServices} from "./strategy/services/oauth/oauth.service";
import {AuthFactorModule} from "@spica-server/passport/authfactor";
import LoginSchema from "./schemas/login.json" with {type: "json"};
import StrategySchema from "./schemas/strategy.json" with {type: "json"};
import {RefreshTokenModule} from "@spica-server/passport/refresh_token";

@Global()
@Module({})
class PassportCoreModule {
  static initialize(defaultStrategy?: string): DynamicModule {
    return {
      module: PassportCoreModule,
      imports: [
        CorePassportModule.register({
          defaultStrategy: defaultStrategy,
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
    preference.default({scope: "passport", identity: {attributes: {}}, user: {attributes: {}}});
  }

  static forRoot(options: PassportOptions): DynamicModule {
    return {
      module: PassportModule,
      controllers: [PassportIdentityController, PassportUserController, StrategyController],
      imports: [
        SchemaModule.forChild({
          schemas: [LoginSchema, StrategySchema]
        }),
        PassportCoreModule.initialize(options.defaultStrategy),
        IdentityModule.forRoot(options.identityOptions),
        UserModule.forRoot(options.userOptions),
        PolicyModule.forRoot({realtime: options.policyRealtime}),
        ApiKeyModule.forRoot({realtime: options.apikeyRealtime}),
        RefreshTokenModule.forRoot({
          expiresIn: options.identityOptions.refreshTokenExpiresIn,
          realtime: options.refreshTokenRealtime
        }),
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
            const oauthStrategies = initializeOAuthServices(ser, ops, req);
            const strategies = [...oauthStrategies, new SamlService(ser, ops)];

            return {
              find: (type: string, idp?: string) =>
                strategies.find(strategy => {
                  if (type == "oauth") {
                    return strategy.type == type && strategy.idp == idp;
                  }
                  return strategy.type == type;
                })
            };
          },
          inject: [StrategyService, PASSPORT_OPTIONS, REQUEST_SERVICE]
        },
        {provide: PASSPORT_OPTIONS, useValue: options}
      ]
    };
  }
}
