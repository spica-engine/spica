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
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const type = change.type;

        const overwriteSlug = envVar => {
          if (change.resource_slug) {
            envVar.key = change.resource_slug;
          }
        };

        switch (type) {
          case ChangeType.CREATE: {
            const envVar: EnvVar = YAML.parse(change.resource_content);
            overwriteSlug(envVar);
            await validate(envVar, validator);
            await CRUD.insert(evs, envVar);
            return {status: SyncStatuses.SUCCEEDED};
          }
          case ChangeType.UPDATE: {
            const envVar: EnvVar = YAML.parse(change.resource_content);
            const existing = await evs.findOne({key: change.resource_slug});
            if (existing) {
              envVar._id = existing._id;
            }
            overwriteSlug(envVar);
            await validate(envVar, validator);
            await CRUD.replace(evs, envVar);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.DELETE: {
            const existing = await evs.findOne({key: change.resource_slug});
            if (!existing) {
              return {status: SyncStatuses.FAILED, reason: "EnvVar not found"};
            }
            await CRUD.remove(evs, existing._id.toString());
            return {status: SyncStatuses.SUCCEEDED};
          }

          default:
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${type}`
            };
        }
      } catch (error: any) {
        logger.warn(`Error applying env_var change: ${error.stack || String(error)}`);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
