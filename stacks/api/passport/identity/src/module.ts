import {Module, Global, DynamicModule, Inject} from "@nestjs/common";
import {SchemaResolver, provideSchemaResolver} from "./schema.resolver";
import {Validator, SchemaModule} from "@spica-server/core/schema";
import {PreferenceService, IDENTITY_SETTINGS_FINALIZER} from "@spica-server/preference/services";
import {JwtModule} from "@nestjs/jwt";
import {IdentityOptions, IDENTITY_OPTIONS} from "./options";
import {IdentityController} from "./identity.controller";
import {IdentityService} from "./identity.service";
import {IdentityStrategy} from "./identity.strategy";
import {provideSettingsFinalizer} from "./utility";

@Global()
@Module({})
export class IdentityModule {
  constructor(
    @Inject(IDENTITY_OPTIONS) options: IdentityOptions,
    private identityService: IdentityService
  ) {
    if (options.defaultIdentityIdentifier) {
      identityService.default({
        identifier: options.defaultIdentityIdentifier,
        password: options.defaultIdentityPassword,
        policies: options.defaultIdentityPolicies
      });
    }
  }

  static forRoot(options: IdentityOptions): DynamicModule {
    return {
      module: IdentityModule,
      controllers: [IdentityController],
      exports: [IdentityService, IdentityStrategy, IDENTITY_SETTINGS_FINALIZER],
      imports: [
        JwtModule.register({
          secret: options.secretOrKey,
          signOptions: {
            audience: options.audience,
            issuer: options.issuer,
            expiresIn: options.expiresIn
          }
        }),
        SchemaModule.forChild({
          schemas: [require(`./schemas/identity.json`), require(`./schemas/identity-create.json`)]
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
        }
      ]
    };
  }
}
