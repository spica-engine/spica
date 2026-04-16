import {Module, Global, DynamicModule, Inject, Optional} from "@nestjs/common";
import {Validator, SchemaModule} from "@spica-server/core-schema";
import {JwtModule} from "@nestjs/jwt";
import {
  UserOptions,
  USER_OPTIONS,
  POLICY_PROVIDER,
  VERIFICATION_PROVIDERS_INITIALIZER
} from "@spica-server/interface-passport-user";
import {UserController} from "./user.controller.js";
import {UserService} from "./user.service.js";
import {UserStrategy} from "./user.strategy.js";
import {providePolicyFinalizer} from "./utility.js";
import {PolicyService} from "@spica-server/passport-policy";
import {USER_POLICY_FINALIZER} from "@spica-server/interface-passport-policy";
import {registerStatusProvider} from "./status.js";
import userSchema from "./schemas/user.json" with {type: "json"};
import userCreateSchema from "./schemas/user-create.json" with {type: "json"};
import userUpdateSchema from "./schemas/user-update.json" with {type: "json"};
import userSelfUpdateSchema from "./schemas/user-self-update.json" with {type: "json"};
import AuthFactorSchema from "./schemas/authfactor.json" with {type: "json"};
import passwordlessLoginStartSchema from "./schemas/passwordless-login-start.json" with {type: "json"};
import passwordlessLoginVerifySchema from "./schemas/passwordless-login-verify.json" with {type: "json"};
import forgotPasswordStartSchema from "./schemas/forgot-password-start.json" with {type: "json"};
import forgotPasswordVerifySchema from "./schemas/forgot-password-verify.json" with {type: "json"};
import {RefreshTokenServicesModule} from "@spica-server/passport-refresh_token-services";
import {UserRealtimeModule} from "@spica-server/passport-user-realtime";
import {VerificationService} from "./verification.service.js";
import {
  VerificationProviderRegistry,
  EmailVerificationProvider,
  PhoneVerificationProvider
} from "./providers/index.js";
import {MailerService} from "@spica-server/mailer";
import {SmsService} from "@spica-server/sms";
import {UserConfigService} from "./config.service.js";
import {ProviderVerificationService} from "./services/provider.verification.service.js";
import {PasswordlessLoginService} from "./services/passwordless-login.service.js";
import {PasswordResetService} from "./services/password-reset.service.js";
import {REGISTER_CONFIG_SCHEMA, RegisterConfigSchema} from "@spica-server/interface-config";
import {provideUserPasswordPolicySchemaResolver} from "./password-policy.schema.resolver.js";
import {RateLimitService} from "./rate-limit.service.js";

@Global()
@Module({})
export class UserModule {
  constructor(
    @Inject(USER_OPTIONS) options: UserOptions,
    private userService: UserService,
    @Optional()
    @Inject(REGISTER_CONFIG_SCHEMA)
    registerConfigSchema: RegisterConfigSchema
  ) {
    registerStatusProvider(userService);
    if (registerConfigSchema) {
      registerConfigSchema("user", {
        description: "Configuration for the User module",
        type: "object",
        properties: {
          verificationProcessMaxAttempt: {
            description:
              "Maximum number of attempts allowed for verification processes like email or phone verification.",
            type: "integer"
          },
          passwordlessLogin: {
            description: "Configuration for passwordless login providers.",
            type: "object",
            properties: {
              passwordlessLoginProvider: {
                description: "List of providers that can be used for passwordless login.",
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    provider: {
                      description: "The provider type for passwordless login.",
                      type: "string",
                      enum: ["email", "phone"]
                    },
                    strategy: {
                      description: "The strategy used for passwordless login.",
                      type: "string",
                      enum: ["Otp", "MagicLink"]
                    }
                  }
                }
              }
            }
          },
          resetPasswordProvider: {
            description: "List of providers that can be used for password reset.",
            type: "array",
            items: {
              type: "object",
              properties: {
                provider: {
                  description: "The provider type for password reset.",
                  type: "string",
                  enum: ["email", "phone"]
                },
                strategy: {
                  description: "The strategy used for password reset.",
                  type: "string",
                  enum: ["Otp", "MagicLink"]
                }
              }
            }
          },
          providerVerificationConfig: {
            description: "Configuration for verifying user providers like email or phone.",
            type: "array",
            items: {
              type: "object",
              properties: {
                provider: {
                  description: "The provider type for verification.",
                  type: "string",
                  enum: ["email", "phone"]
                },
                strategy: {
                  description: "The strategy used for verification.",
                  type: "string",
                  enum: ["Otp", "MagicLink"]
                }
              }
            }
          },
          rateLimits: {
            description: "Rate limit configurations for various user-related actions.",
            type: "object",
            properties: {
              login: {
                description: "Rate limit configuration for login attempts.",
                type: "object",
                properties: {
                  limit: {
                    type: "integer",
                    description:
                      "Maximum number of login attempts allowed within the specified time-to-live (TTL).",
                    minimum: 1
                  },
                  ttl: {
                    type: "integer",
                    description: "Time-to-live (TTL) in seconds for the rate limit window.",
                    minimum: 1
                  }
                },
                required: ["limit", "ttl"]
              },
              providerVerification: {
                type: "object",
                description: "Rate limit configuration for provider verification attempts.",
                properties: {
                  limit: {
                    type: "integer",
                    description:
                      "Maximum number of provider verification attempts allowed within the specified time-to-live (TTL).",
                    minimum: 1
                  },
                  ttl: {
                    type: "integer",
                    description:
                      "Time-to-live (TTL) in seconds for the provider verification rate limit window.",
                    minimum: 1
                  }
                },
                required: ["limit", "ttl"]
              },
              forgotPassword: {
                type: "object",
                description: "Rate limit configuration for forgot password attempts.",
                properties: {
                  limit: {
                    type: "integer",
                    description:
                      "Maximum number of forgot password attempts allowed within the specified time-to-live (TTL).",
                    minimum: 1
                  },
                  ttl: {
                    type: "integer",
                    description:
                      "Time-to-live (TTL) in seconds for the forgot password rate limit window.",
                    minimum: 1
                  }
                },
                required: ["limit", "ttl"]
              },
              refreshToken: {
                type: "object",
                description: "Rate limit configuration for refresh token attempts.",
                properties: {
                  limit: {
                    type: "integer",
                    description:
                      "Maximum number of refresh token attempts allowed within the specified time-to-live (TTL).",
                    minimum: 1
                  },
                  ttl: {
                    type: "integer",
                    description:
                      "Time-to-live (TTL) in seconds for the refresh token rate limit window.",
                    minimum: 1
                  }
                },
                required: ["limit", "ttl"]
              },
              createUser: {
                type: "object",
                description: "Rate limit configuration for create user attempts.",
                properties: {
                  limit: {
                    type: "integer",
                    description:
                      "Maximum number of create user attempts allowed within the specified time-to-live (TTL).",
                    minimum: 1
                  },
                  ttl: {
                    type: "integer",
                    description:
                      "Time-to-live (TTL) in seconds for the create user rate limit window.",
                    minimum: 1
                  }
                },
                required: ["limit", "ttl"]
              }
            }
          }
        }
      });
    }
  }

  static forRoot(options: UserOptions): DynamicModule {
    const module: DynamicModule = {
      module: UserModule,
      controllers: [UserController],
      exports: [UserService, UserStrategy, USER_POLICY_FINALIZER, USER_OPTIONS, RateLimitService],
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
            AuthFactorSchema,
            passwordlessLoginStartSchema,
            passwordlessLoginVerifySchema,
            forgotPasswordStartSchema,
            forgotPasswordVerifySchema
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
        PasswordlessLoginService,
        UserConfigService,
        VerificationProviderRegistry,
        ProviderVerificationService,
        PasswordResetService,
        RateLimitService,
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
          provide: "USER_PASSWORD_POLICY_RESOLVER",
          useFactory: (validator: Validator, configService: UserConfigService) => {
            return provideUserPasswordPolicySchemaResolver(validator, configService, {
              "http://spica.internal/passport/user-create": userCreateSchema,
              "http://spica.internal/passport/user-update": userUpdateSchema,
              "http://spica.internal/passport/user-self-update": userSelfUpdateSchema
            });
          },
          inject: [Validator, UserConfigService]
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
