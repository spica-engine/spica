import {DynamicModule, Global, Module} from "@nestjs/common";
import {JwtModule} from "@nestjs/jwt";
import {PassportModule as CorePassportModule} from "@nestjs/passport";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {DatabaseService} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference";
import {readdirSync} from "fs";
import {IdentityService} from "./identity";
import {IdentityController} from "./identity/identity.controller";
import {PassportOptions, PASSPORT_OPTIONS} from "./interface";
import {JwtStrategy} from "./jwt.strategy";
import {PassportController} from "./passport.controller";
import {PassportService} from "./passport.service";
import {PolicyService} from "./policy";
import {PolicyController} from "./policy/policy.controller";
import {SamlService} from "./saml.service";
import {provideSchemaResolver, SchemaResolver} from "./schema.resolver";
import {StrategyController} from "./strategies/strategy.controller";
import {StrategyService} from "./strategies/strategy.service";

@Global()
@Module({})
class PassportCoreModule {
  static initialize(options: PassportOptions): DynamicModule {
    return {
      module: PassportCoreModule,
      imports: [
        CorePassportModule.register({defaultStrategy: "jwt", session: false}),
        JwtModule.register({
          secret: options.secretOrKey,
          signOptions: {audience: options.audience, issuer: options.issuer, expiresIn: "2 days"}
        }),
        SchemaModule.forChild()
      ],
      exports: [PolicyService, IdentityService, JwtModule, CorePassportModule],
      providers: [
        {
          provide: PolicyService,
          useFactory: db => {
            return new PolicyService(
              db,
              readdirSync(`${__dirname}/policies`).map(f => require(`${__dirname}/policies/${f}`)),
              readdirSync(`${__dirname}/services`).map(f => require(`${__dirname}/services/${f}`))
            );
          },
          inject: [DatabaseService]
        },
        {
          provide: IdentityService,
          useFactory: (db, validator) => {
            return new IdentityService(
              db,
              readdirSync(`${__dirname}/identity`).map(f => require(`${__dirname}/identity/${f}`)),
              readdirSync(`${__dirname}/services`).map(f => require(`${__dirname}/services/${f}`)),
              validator
            );
          },
          inject: [DatabaseService, Validator]
        }
      ]
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
      controllers: [PassportController, IdentityController, PolicyController, StrategyController],
      imports: [
        PassportCoreModule.initialize(options),
        SchemaModule.forChild({
          schemas: readdirSync(`${__dirname}/schemas`).map(f =>
            require(`${__dirname}/schemas/${f}`)
          )
        })
      ],
      providers: [
        StrategyService,
        SamlService,
        JwtStrategy,
        {provide: PASSPORT_OPTIONS, useValue: options},
        {
          provide: PassportService,
          useClass: PassportService,
          inject: [DatabaseService, PASSPORT_OPTIONS]
        },
        {
          provide: SchemaResolver,
          useFactory: provideSchemaResolver,
          inject: [Validator, PreferenceService]
        }
      ]
    };
  }
}
