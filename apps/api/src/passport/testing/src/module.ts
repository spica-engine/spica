import {DynamicModule, Global, Inject, Module, Optional} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {GuardService} from "@spica-server/passport/guard/services";
import {AuthFactor} from "@spica-server/passport/authfactor";
import {TestingOptions} from "@spica-server/interface/passport/testing";
import {NoopStrategy} from "./noop.strategy";
import {AUTH_RESOLVER} from "@spica-server/interface/bucket/common";

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
  constructor() {}

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
