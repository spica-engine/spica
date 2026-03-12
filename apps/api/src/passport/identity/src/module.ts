import {Module, Global, DynamicModule, Inject, Optional} from "@nestjs/common";
import {Validator, SchemaModule} from "@spica-server/core/schema";
import {PreferenceService} from "@spica-server/preference/services";
import {JwtModule} from "@nestjs/jwt";
import {
  IdentityOptions,
  IDENTITY_OPTIONS,
  POLICY_PROVIDER
} from "@spica-server/interface/passport/identity";
import {IdentityController} from "./identity.controller";
import {IdentityService} from "./identity.service";
import {IdentityStrategy} from "./identity.strategy";
import {providePolicyFinalizer} from "./utility";
import {PolicyService} from "@spica-server/passport/policy";
import {IDENTITY_POLICY_FINALIZER} from "@spica-server/interface/passport/policy";
import {registerStatusProvider} from "./status";
import IdentitySchema from "./schemas/identity.json" with {type: "json"};
import IdentityCreateSchema from "./schemas/identity-create.json" with {type: "json"};
import AuthFactorSchema from "./schemas/authfactor.json" with {type: "json"};
import {registerAssetHandlers} from "./asset";
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {RefreshTokenServicesModule} from "@spica-server/passport/refresh_token/services";
import {IdentityRealtimeModule} from "../realtime";
import {IdentityConfigService} from "./config.service";
import {REGISTER_CONFIG_SCHEMA, RegisterConfigSchema} from "@spica-server/interface/config";
import {provideIdentityPasswordPolicySchemaResolver} from "./password-policy.schema.resolver";

@Global()
@Module({})
export class IdentityModule {
  constructor(
    @Inject(IDENTITY_OPTIONS) options: IdentityOptions,
    private identityService: IdentityService,
    private prefService: PreferenceService,
    @Optional() @Inject(ASSET_REP_MANAGER) private repManager: IRepresentativeManager,
    @Optional()
    @Inject(REGISTER_CONFIG_SCHEMA)
    registerConfigSchema: RegisterConfigSchema
  ) {
    if (options.defaultIdentityIdentifier) {
      identityService.default({
        identifier: options.defaultIdentityIdentifier,
        password: options.defaultIdentityPassword,
        policies: options.defaultIdentityPolicies,
        lastPasswords: [],
        failedAttempts: [],
        lastLogin: undefined
      });
    }
    registerStatusProvider(identityService);
    registerAssetHandlers(prefService, repManager);
    if (registerConfigSchema) {
      registerConfigSchema("identity", {
        type: "object"
      });
    }
  }

  static forRoot(options: IdentityOptions): DynamicModule {
    const module: DynamicModule = {
      module: IdentityModule,
      controllers: [IdentityController],
      exports: [IdentityService, IdentityStrategy, IDENTITY_POLICY_FINALIZER, IDENTITY_OPTIONS],
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
          schemas: [IdentitySchema, IdentityCreateSchema, AuthFactorSchema],
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
        IdentityConfigService,
        IdentityService,
        IdentityStrategy,
        {
          provide: IDENTITY_OPTIONS,
          useValue: options
        },
        {
          provide: IDENTITY_POLICY_FINALIZER,
          useFactory: providePolicyFinalizer,
          inject: [IdentityService]
        },
        {
          provide: POLICY_PROVIDER,
          useFactory: PolicyProviderFactory,
          inject: [PolicyService]
        },
        {
          provide: "IDENTITY_PASSWORD_POLICY_RESOLVER",
          useFactory: (validator: Validator, configService: IdentityConfigService) => {
            return provideIdentityPasswordPolicySchemaResolver(validator, configService, {
              "http://spica.internal/passport/identity-create": IdentityCreateSchema,
              "http://spica.internal/passport/identity": IdentitySchema
            });
          },
          inject: [Validator, IdentityConfigService]
        }
      ]
    };

    if (options.identityRealtime) {
      module.imports.push(IdentityRealtimeModule.register());
    }

    return module;
  }
}

export const PolicyProviderFactory = (service: PolicyService) => {
  return async (req: any) => {
    const identityPolicies = [
      {
        statement: [
          {
            module: "passport:identity",
            action: "passport:identity:show",
            resource: {include: [req.user._id], exclude: []}
          },
          {
            module: "passport:identity",
            action: "passport:identity:update",
            resource: {include: [req.user._id], exclude: []}
          }
        ]
      }
    ];

    const actualPolicies = await service._findAll();
    return req.user.policies
      .map(upi => actualPolicies.find(ap => ap._id == upi))
      .concat(identityPolicies);
  };
};
