import {DynamicModule, Global, Inject, Module, Optional} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {GuardService} from "../..";
import {AuthFactor} from "../../authfactor";
import {PreferenceService} from "../../../preference/services";
import {TestingOptions} from "../../../../../../libs/interface/passport/testing";
import {NoopStrategy} from "./noop.strategy";
import {AUTH_RESOLVER} from "../../../../../../libs/interface/bucket/common";

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
