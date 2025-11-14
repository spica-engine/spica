import {EnvVarService} from "../../../services";
import * as CRUD from "../../../src/crud";
import {EnvVar} from "@spica-server/interface/env_var";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeApplier,
  ApplyResult,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";

const module = "env-var";
const subModule = "schema";
const fileExtension = "yaml";

export const applier = (evs: EnvVarService): ChangeApplier => {
  return {
    module,
    subModule,
    fileExtension,
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const type = change.type;
        const envVar: EnvVar = YAML.parse(change.resource_content);
        switch (type) {
          case ChangeType.CREATE:
            await CRUD.insert(evs, envVar);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.UPDATE:
            await CRUD.replace(evs, envVar);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            await CRUD.remove(evs, change.resource_id);
            return {status: SyncStatuses.SUCCEEDED};

          default:
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${type}`
            };
        }
      } catch (error: any) {
        console.warn("Error applying env_var change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
