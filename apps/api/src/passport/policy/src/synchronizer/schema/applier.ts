import {PolicyService} from "@spica-server/passport/policy";
import {changeFactory, Policy} from "@spica-server/interface/passport/policy";
import YAML from "yaml";
import * as CRUD from "../../../src/crud";
import {
  ChangeLog,
  ApplyResult,
  ChangeType,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";
import {ObjectId} from "bson";
import {Logger} from "@nestjs/common";
import {Schema, Validator} from "@spica-server/core/schema";

const logger = new Logger("PolicySyncApplier");

const module = "policy";
const subModule = "schema";
const fileExtension = "yaml";

function validate(policy: Policy, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/passport/policy");
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(policy);
}

export function getApplier(
  ps: PolicyService,
  apikeyFinalizer: changeFactory,
  identityFinalizer: changeFactory,
  validator: Validator
): DocumentChangeApplier {
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;

        const overwriteSlug = policy => {
          if (change.resource_slug) {
            policy.name = change.resource_slug;
          }
        };

        switch (operationType) {
          case ChangeType.CREATE: {
            const policy: Policy = YAML.parse(change.resource_content);
            overwriteSlug(policy);
            await validate(policy, validator);
            await CRUD.insert(ps, policy);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.UPDATE: {
            const policy: Policy = YAML.parse(change.resource_content);
            const existing = await ps.findOne({name: change.resource_slug});
            if (existing) {
              policy._id = existing._id.toString();
            }
            overwriteSlug(policy);
            await validate(policy, validator);
            await CRUD.replace(ps, policy);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.DELETE: {
            const existing = await ps.findOne({name: change.resource_slug});
            if (!existing) {
              return {status: SyncStatuses.FAILED, reason: "Policy not found"};
            }
            await CRUD.remove(ps, existing._id as ObjectId, apikeyFinalizer, identityFinalizer);
            return {status: SyncStatuses.SUCCEEDED};
          }

          default:
            logger.warn(`Unknown operation type: ${operationType}`);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        logger.warn(`Error applying policy change: ${(error as any).stack || String(error)}`);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
}
