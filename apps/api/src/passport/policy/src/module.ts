import {DynamicModule, Global, Inject, Module, Optional} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {PolicyResolver, POLICY_RESOLVER} from "@spica-server/interface/passport/guard";
import {Policy} from "@spica-server/interface/passport/policy";
import {PolicyController} from "./policy.controller";
import {PolicyService} from "./policy.service";
import PolicySchema from "./schemas/policy.json" with {type: "json"};
import {getSynchronizer} from "./versioncontrol/synchronizer";
import {
  REGISTER_VC_SYNCHRONIZER,
  RegisterVCSynchronizer
} from "@spica-server/interface/versioncontrol";
import {PolicyRealtimeModule} from "../realtime";
@Global()
@Module({})
export class PolicyModule {
  static forRoot({realtime}): DynamicModule {
    const module: DynamicModule = {
      module: PolicyModule,
      imports: [
        SchemaModule.forChild({
          schemas: [PolicySchema]
        })
      ],
      exports: [PolicyService, POLICY_RESOLVER],
      controllers: [PolicyController],
      providers: [
        PolicyService,
        {
          provide: POLICY_RESOLVER,
          useFactory: (policyService: PolicyService): PolicyResolver<Policy> => {
            return async (ids: string[]) => {
              const policies = await policyService._findAll();
              return policies.filter(policy => ids.indexOf(policy._id.toString()) != -1);
            };
          },
          inject: [PolicyService]
        }
      ]
    };

    if (realtime) {
      module.imports.push(PolicyRealtimeModule.register());
    }

    return module;
  }

  constructor(
    ps: PolicyService,
    @Optional()
    @Inject(REGISTER_VC_SYNCHRONIZER)
    registerVCSynchronizer: RegisterVCSynchronizer<Policy>
  ) {
    if (registerVCSynchronizer) {
      const synchronizer = getSynchronizer(ps);
      registerVCSynchronizer(synchronizer);
    }
  }
}
