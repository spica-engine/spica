import {PolicyService} from "../../../src/policy.service";
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

const module = "policy";
const subModule = "schema";
const fileExtension = "yaml";

export function getApplier(
  ps: PolicyService,
  apikeyFinalizer: changeFactory,
  identityFinalizer: changeFactory
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
      } catch (error) {
        console.error("YAML parsing error:", error);
        return Promise.resolve(null);
      }

      return findPolicyByName(policy.name);
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;
        const policy: Policy = YAML.parse(change.resource_content);

        switch (operationType) {
          case ChangeType.CREATE:
            await CRUD.insert(ps, policy);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.UPDATE:
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
