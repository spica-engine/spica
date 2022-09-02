import {DynamicModule, Global, Module} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {GuardService} from "@spica-server/passport";
import {AuthFactor} from "@spica-server/passport/authfactor";
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

@Global()
@Module({})
export class PassportTestingModule {
  static initialize(options?: TestingOptions): DynamicModule {
    options = options || {};
    options.skipActionCheck = options.skipActionCheck == undefined ? true : options.skipActionCheck;
    return {
      module: PassportTestingModule,
      imports: [
        PassportModule.register({defaultStrategy: "noop", session: false}),
        MockAuthFactorModule
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
