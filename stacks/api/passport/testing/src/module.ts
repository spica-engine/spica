import {DynamicModule, Global, Inject, Module, Optional} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {GuardService} from "@spica-server/passport";
import {AuthFactor} from "@spica-server/passport/authfactor";
import {PreferenceService} from "@spica-server/preference/services";
import {ClassCommander} from "@spica-server/replication";
import {ReplicationTestingModule} from "@spica-server/replication/testing";
import {TestingOptions} from "./interface";
import {NoopStrategy} from "./noop.strategy";

@Global()
@Module({
  imports: [ReplicationTestingModule.create()],
  providers: [
    {
      provide: AuthFactor,
      useFactory: cmd => new AuthFactor(new Map(), [], cmd),
      inject: [ClassCommander]
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
