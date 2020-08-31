import {Global, Module, DynamicModule} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseService} from "@spica-server/database";
import {PolicyResolver, POLICY_RESOLVER} from "@spica-server/passport/guard";
import * as fs from "fs";
import * as path from "path";
import {Policy} from "./interface";
import {PolicyController} from "./policy.controller";
import {PolicyService} from "./policy.service";

@Global()
@Module({})
export class PolicyModule {
  static forRoot(): DynamicModule {
    return {
      module: PolicyModule,
      imports: [
        SchemaModule.forChild({
          schemas: [require(`./schemas/policy.json`), require(`./schemas/policy-list.json`)]
        })
      ],
      exports: [PolicyService, POLICY_RESOLVER],
      controllers: [PolicyController],
      providers: [
        {
          provide: POLICY_RESOLVER,
          useFactory: (policyService: PolicyService): PolicyResolver<Policy> => {
            return async (ids: string[]) => {
              const policies = await policyService._findAll();
              return policies.filter(policy => ids.indexOf(policy._id) != -1);
            };
          },
          inject: [PolicyService]
        },
        {
          provide: PolicyService,
          useFactory: db => {
            return new PolicyService(
              db,
              fs
                .readdirSync(`${path.join(__dirname, "..")}/policies`)
                .map(f => require(`${path.join(__dirname, "..")}/policies/${f}`)),
              fs
                .readdirSync(`${path.join(__dirname, "..")}/services`)
                .map(f => require(`${path.join(__dirname, "..")}/services/${f}`))
            );
          },
          inject: [DatabaseService]
        }
      ]
    };
  }
}
