import {DynamicModule, Global, Module} from "@nestjs/common";
import {SchemaModule} from "@spica/core";
import {PolicyResolver, POLICY_RESOLVER} from "@spica/api/src/passport/guard";
import {Policy} from "./interface";
import {PolicyController} from "./policy.controller";
import {PolicyService} from "./policy.service";
import PolicySchema = require("./schemas/policy.json");

@Global()
@Module({})
export class PolicyModule {
  static forRoot(): DynamicModule {
    return {
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
  }
}
