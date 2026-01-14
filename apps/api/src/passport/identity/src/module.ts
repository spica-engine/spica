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
import {AuthResolver} from "./relation";
import {AUTH_RESOLVER} from "@spica-server/interface/bucket/common";
import {registerAssetHandlers} from "./asset";
import {ASSET_REP_MANAGER} from "@spica-server/interface/asset";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {RefreshTokenServicesModule} from "@spica-server/passport/refresh_token/services";
import {IdentityRealtimeModule} from "../realtime";

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
        policies: options.defaultIdentityPolicies,
        lastPasswords: [],
        failedAttempts: [],
        lastLogin: undefined
      });
    }
    registerStatusProvider(identityService);
    registerAssetHandlers(prefService, repManager);
  }

  static forRoot(options: IdentityOptions): DynamicModule {
    const module: DynamicModule = {
      module: IdentityModule,
      controllers: [IdentityController],
      exports: [IdentityService, IdentityStrategy, IDENTITY_POLICY_FINALIZER, AUTH_RESOLVER],
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
          provide: AUTH_RESOLVER,
          useFactory: (identityService: IdentityService) => new AuthResolver(identityService),
          inject: [IdentityService]
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
