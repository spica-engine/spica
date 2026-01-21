import {Module, Global, DynamicModule, Inject, Optional} from "@nestjs/common";
import {SchemaResolver, provideSchemaResolver} from "./schema.resolver";
import {Validator, SchemaModule} from "@spica-server/core/schema";
import {PreferenceService} from "@spica-server/preference/services";
import {USER_SETTINGS_FINALIZER} from "@spica-server/interface/preference";
import {JwtModule} from "@nestjs/jwt";
import {
  UserOptions,
  USER_OPTIONS,
  POLICY_PROVIDER,
  VERIFICATION_PROVIDERS_INITIALIZER
} from "@spica-server/interface/passport/user";
import {UserController} from "./user.controller";
import {UserService} from "./user.service";
import {UserStrategy} from "./user.strategy";
import {provideSettingsFinalizer, providePolicyFinalizer} from "./utility";
import {PolicyService} from "@spica-server/passport/policy";
import {USER_POLICY_FINALIZER} from "@spica-server/interface/passport/policy";
import {registerStatusProvider} from "./status";
import userSchema from "./schemas/user.json" with {type: "json"};
import userCreateSchema from "./schemas/user-create.json" with {type: "json"};
import userUpdateSchema from "./schemas/user-update.json" with {type: "json"};
import userSelfUpdateSchema from "./schemas/user-self-update.json" with {type: "json"};
import AuthFactorSchema from "./schemas/authfactor.json" with {type: "json"};
import {AuthResolver} from "./relation";
import {AUTH_RESOLVER} from "@spica-server/interface/bucket/common";
import {registerAssetHandlers} from "./asset";
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {RefreshTokenServicesModule} from "@spica-server/passport/refresh_token/services";
import {UserRealtimeModule} from "../realtime";
import {VerificationService} from "./verification.service";
import {
  VerificationProviderRegistry,
  EmailVerificationProvider,
  PhoneVerificationProvider
} from "./providers";
import {MailerService} from "@spica-server/mailer";
import {SmsService} from "@spica-server/sms";

@Global()
@Module({})
export class UserModule {
  constructor(
    @Inject(USER_OPTIONS) options: UserOptions,
    private userService: UserService,
    private prefService: PreferenceService,
    @Optional() @Inject(ASSET_REP_MANAGER) private repManager: IRepresentativeManager
  ) {
    if (options.defaultUserUsername) {
      userService.default({
        username: options.defaultUserUsername,
        password: options.defaultUserPassword,
        policies: options.defaultUserPolicies,
        lastPasswords: [],
        failedAttempts: [],
        lastLogin: undefined
      });
    }
    registerStatusProvider(userService);
    registerAssetHandlers(prefService, repManager);
  }

  static forRoot(options: UserOptions): DynamicModule {
    const module: DynamicModule = {
      module: UserModule,
      controllers: [UserController],
      exports: [
        UserService,
        UserStrategy,
        USER_SETTINGS_FINALIZER,
        USER_POLICY_FINALIZER,
        AUTH_RESOLVER
      ],
      imports: [
        RefreshTokenServicesModule,
        JwtModule.register({
          secret: options.secretOrKey,
          signOptions: {
            audience: options.audience,
            issuer: options.issuer
          }
        }),
        SchemaModule.forChild({
          schemas: [
            userSchema,
            userCreateSchema,
            userUpdateSchema,
            userSelfUpdateSchema,
            AuthFactorSchema
          ],
          customFields: [
            "options",
            // relation
            "bucketId",
            "relationType"
            // "dependent"
          ]
        })
      ],
      providers: [
        UserService,
        UserStrategy,
        VerificationService,
        VerificationProviderRegistry,
        {
          provide: USER_OPTIONS,
          useValue: options
        },
        {
          provide: VERIFICATION_PROVIDERS_INITIALIZER,
          useFactory: (
            registry: VerificationProviderRegistry,
            mailerService: MailerService | null,
            smsService: SmsService | null
          ) => {
            if (mailerService) {
              const emailProvider = new EmailVerificationProvider(mailerService);
              registry.register(emailProvider);
            }

            if (smsService) {
              const smsProvider = new PhoneVerificationProvider(smsService);
              registry.register(smsProvider);
            }
          },
          inject: [
            VerificationProviderRegistry,
            {token: MailerService, optional: true},
            {token: SmsService, optional: true}
          ]
        },
        {
          provide: SchemaResolver,
          useFactory: provideSchemaResolver,
          inject: [Validator, PreferenceService]
        },
        {
          provide: USER_SETTINGS_FINALIZER,
          useFactory: provideSettingsFinalizer,
          inject: [UserService]
        },
        {
          provide: USER_POLICY_FINALIZER,
          useFactory: providePolicyFinalizer,
          inject: [UserService]
        },
        {
          provide: POLICY_PROVIDER,
          useFactory: PolicyProviderFactory,
          inject: [PolicyService]
        },
        {
          provide: AUTH_RESOLVER,
          useFactory: (i, p) => new AuthResolver(i, p),
          inject: [UserService, PreferenceService]
        }
      ]
    };

    if (options.userRealtime) {
      module.imports.push(UserRealtimeModule.register());
    }

    return module;
  }
}

export const PolicyProviderFactory = (service: PolicyService) => {
  return async (req: any) => {
    const userPolicies = [
      {
        statement: [
          {
            module: "passport:user",
            action: "passport:user:show",
            resource: {include: [req.user._id], exclude: []}
          },
          {
            module: "passport:user",
            action: "passport:user:update",
            resource: {include: [req.user._id], exclude: []}
          }
        ]
      }
    ];

    const actualPolicies = await service._findAll();
    return req.user.policies
      .map(upi => actualPolicies.find(ap => ap._id == upi))
      .concat(userPolicies);
  };
};
