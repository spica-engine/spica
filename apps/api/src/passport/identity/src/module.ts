import {Module, Global, DynamicModule, Inject, Optional} from "@nestjs/common";
import {SchemaResolver, provideSchemaResolver} from "./schema.resolver";
import {Validator, SchemaModule} from "@spica-server/core/schema";
import {PreferenceService} from "@spica-server/preference/services";
import {IDENTITY_SETTINGS_FINALIZER} from "@spica-server/interface/preference";
import {JwtModule} from "@nestjs/jwt";
import {
  IdentityOptions,
  IDENTITY_OPTIONS,
  POLICY_PROVIDER
} from "@spica-server/interface/passport/identity";
import {IdentityController} from "./identity.controller";
import {IdentityService} from "./identity.service";
import {IdentityStrategy} from "./identity.strategy";
import {provideSettingsFinalizer, providePolicyFinalizer} from "./utility";
import {PolicyService} from "@spica-server/passport/policy";
import {IDENTITY_POLICY_FINALIZER} from "@spica-server/interface/passport/policy";
import {registerStatusProvider} from "./status";
import IdentitySchema from "./schemas/identity.json" with {type: "json"};
import IdentityCreateSchema from "./schemas/identity-create.json" with {type: "json"};
import AuthFactorSchema from "./schemas/authfactor.json" with {type: "json"};
import {AuthResolver} from "./relation";
import {AUTH_RESOLVER} from "@spica-server/interface/bucket/common";
import {registerAssetHandlers} from "./asset";
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";
import {IRepresentativeManager} from "@spica-server/interface/representative";

@Global()
@Module({})
export class IdentityModule {
  constructor(
    @Inject(IDENTITY_OPTIONS) options: IdentityOptions,
    private identityService: IdentityService,
    private prefService: PreferenceService,
    @Optional() @Inject(ASSET_REP_MANAGER) private repManager: IRepresentativeManager
  ) {
    if (options.defaultIdentityIdentifier) {
      identityService.default({
        identifier: options.defaultIdentityIdentifier,
        password: options.defaultIdentityPassword,
        policies: options.defaultIdentityPolicies
      });
    }
    registerStatusProvider(identityService);
    registerAssetHandlers(prefService, repManager);
  }

  static forRoot(options: IdentityOptions): DynamicModule {
    return {
      module: IdentityModule,
      controllers: [IdentityController],
      exports: [
        IdentityService,
        IdentityStrategy,
        IDENTITY_SETTINGS_FINALIZER,
        IDENTITY_POLICY_FINALIZER,
        AUTH_RESOLVER
      ],
      imports: [
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
        IdentityService,
        IdentityStrategy,
        {
          provide: IDENTITY_OPTIONS,
          useValue: options
        },
        {
          provide: SchemaResolver,
          useFactory: provideSchemaResolver,
          inject: [Validator, PreferenceService]
        },
        {
          provide: IDENTITY_SETTINGS_FINALIZER,
          useFactory: provideSettingsFinalizer,
          inject: [IdentityService]
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
          provide: AUTH_RESOLVER,
          useFactory: (i, p) => new AuthResolver(i, p),
          inject: [IdentityService, PreferenceService]
        }
      ]
    };
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
