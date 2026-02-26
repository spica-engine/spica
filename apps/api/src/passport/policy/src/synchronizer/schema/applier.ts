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
import {Schema, Validator} from "@spica-server/core/schema";

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
  validator?: Validator
): DocumentChangeApplier {
  const findPolicyByName = async (name: string) => {
    const policy = await ps.findOne({name});
    return policy?._id?.toString();
  };
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    findIdBySlug: (slug: string): Promise<string> => {
      return findPolicyByName(slug);
    },
    findIdByContent: (content: string): Promise<string> => {
      let policy: Policy;

      try {
        policy = YAML.parse(content);
        return findPolicyByName(policy?.name);
      } catch (error) {
        console.error("YAML parsing error:", error);
        return Promise.resolve(null);
      }
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;
        const policy: Policy = YAML.parse(change.resource_content);

        const overwritePrimaries = (change: ChangeLog, policy) => {
          if (change.resource_id) {
            policy._id = change.resource_id;
          }

          if (change.resource_slug) {
            policy.name = change.resource_slug;
          }
        };

        switch (operationType) {
          case ChangeType.CREATE:
            overwritePrimaries(change, policy);
            if (validator) await validate(policy, validator);
            await CRUD.insert(ps, policy);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.UPDATE:
            overwritePrimaries(change, policy);
            if (validator) await validate(policy, validator);
            await CRUD.replace(ps, policy);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            await CRUD.remove(
              ps,
              ObjectId.createFromHexString(change.resource_id),
              apikeyFinalizer,
              identityFinalizer
            );
            return {status: SyncStatuses.SUCCEEDED};

          default:
            console.warn("Unknown operation type:", operationType);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        console.warn("Error applying policy change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
}
