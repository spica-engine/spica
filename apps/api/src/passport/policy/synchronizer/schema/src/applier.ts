import {PolicyService} from "../../../src/policy.service";
import {changeFactory, Policy} from "@spica-server/interface/passport/policy";
import YAML from "yaml";
import * as CRUD from "../../../src/crud";
import {
  ChangeLog,
  ChangeApplier,
  ApplyResult,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import {ObjectId} from "bson";

const module = "policy";
const subModule = "schema";
const fileExtension = "yaml";

export function applier(
  ps: PolicyService,
  apikeyFinalizer: changeFactory,
  identityFinalizer: changeFactory
): ChangeApplier {
  return {
    module,
    subModule,
    fileExtension,
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
              new ObjectId(change.resource_id),
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
