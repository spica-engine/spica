import {EnvVarService} from "@spica-server/env_var/services";
import * as CRUD from "../../../src/crud";
import {EnvVar} from "@spica-server/interface/env_var";
import YAML from "yaml";
import {
  ChangeLog,
  ApplyResult,
  ChangeType,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";

const module = "env-var";
const subModule = "schema";
const fileExtension = "yaml";

export const getApplier = (evs: EnvVarService): DocumentChangeApplier => {
  const findEnvVarByKey = async (key: string) => {
    const envVar = await evs.findOne({key});
    return envVar?._id?.toString();
  };

  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    findIdBySlug: (slug: string): Promise<string> => {
      return findEnvVarByKey(slug);
    },
    findIdByContent: (content: string): Promise<string> => {
      let envVar: EnvVar;

      try {
        envVar = YAML.parse(content);
      } catch (error) {
        console.error("YAML parsing error:", error);
        return Promise.resolve(null);
      }

      return findEnvVarByKey(envVar.key);
    },
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
