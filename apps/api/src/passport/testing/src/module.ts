import {DynamicModule, Global, Inject, Module, Optional} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {GuardService} from "@spica/api/src/passport";
import {AuthFactor} from "@spica/api/src/passport/authfactor";
import {PreferenceService} from "@spica/api/src/preference/services";
import {TestingOptions} from "./interface";
import {NoopStrategy} from "./noop.strategy";

@Global()
@Module({
  providers: [
    {
      provide: "FACTORS_MAP",
      useValue: new Map([])
    },
    {
      provide: AuthFactor,
      useClass: AuthFactor
    }
  ],
  exports: [AuthFactor]
})
export class MockAuthFactorModule {}

const AUTH_RESOLVER = Symbol.for("AUTH_RESOLVER");

@Global()
@Module({
  providers: [
    {
      provide: AUTH_RESOLVER,
      useFactory: (i, p) => {
        return {
          getProperties: () => {
            return {};
          },
          resolveRelations: (identity, aggregation) => {
            return Promise.resolve(identity);
          }
        };
      }
    }
  ],
  exports: [AUTH_RESOLVER]
})
export class MockAuthResolverModule {}

@Global()
@Module({})
export class PassportTestingModule {
  constructor(@Optional() preference: PreferenceService) {
    if (preference) {
      preference.default({scope: "passport", identity: {attributes: {}}});
    }
  }

  static initialize(options?: TestingOptions): DynamicModule {
    options = options || {};
    options.skipActionCheck = options.skipActionCheck == undefined ? true : options.skipActionCheck;
    return {
      module: PassportTestingModule,
      imports: [
        PassportModule.register({defaultStrategy: "noop", session: false}),
        MockAuthFactorModule,
        MockAuthResolverModule
      ],
      exports: [PassportModule, NoopStrategy, GuardService],
      providers: [
        {
          provide: NoopStrategy,
          useFactory: () => new NoopStrategy(options || {})
        },
        GuardService
      ]
    };
  }
}
