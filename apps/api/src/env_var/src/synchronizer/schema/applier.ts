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
import {Schema, Validator} from "@spica-server/core/schema";
import {Logger} from "@nestjs/common";

const logger = new Logger("EnvVarSyncApplier");

const module = "env-var";
const subModule = "schema";
const fileExtension = "yaml";

function validate(envVar: EnvVar, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/env_var");
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(envVar);
}

export const getApplier = (evs: EnvVarService, validator: Validator): DocumentChangeApplier => {
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
        return findEnvVarByKey(envVar?.key);
      } catch (error) {
        logger.error("YAML parsing error:", error instanceof Error ? error.stack : String(error));
        return Promise.resolve(null);
      }
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const type = change.type;
        const envVar: EnvVar = YAML.parse(change.resource_content);

        const overwritePrimaries = (change: ChangeLog, envVar) => {
          if (change.resource_id) {
            envVar._id = change.resource_id;
          }

          if (change.resource_slug) {
            envVar.key = change.resource_slug;
          }
        };

        switch (type) {
          case ChangeType.CREATE:
            overwritePrimaries(change, envVar);
            await validate(envVar, validator);
            await CRUD.insert(evs, envVar);
            return {status: SyncStatuses.SUCCEEDED};
          case ChangeType.UPDATE:
            overwritePrimaries(change, envVar);
            await validate(envVar, validator);
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
        logger.warn("Error applying env_var change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
