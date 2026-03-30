import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {LogService} from "@spica-server/function/log";
import * as CRUD from "../../../src/crud";
import {Function} from "@spica-server/interface/function";
import YAML from "yaml";
import {
  ChangeLog,
  ApplyResult,
  ChangeType,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";
import {Schema, Validator} from "@spica-server/core/schema";
import {generate} from "../../schema/enqueuer.resolver";
import {Logger} from "@nestjs/common";

const logger = new Logger("FunctionSyncApplier");

const module = "function";
const subModule = "schema";
const fileExtension = "yaml";

function validate(fn: Function, validator: Validator): Promise<void> {
  const schema = generate({body: fn});
  deleteEnqueuerValidation(schema);
  const validatorMixin = Schema.validate(schema);
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(fn);
}

function deleteEnqueuerValidation(schema: any) {
  schema.allOf = schema.allOf.map(subSchema => {
    if (!subSchema.properties || !subSchema.properties.triggers) {
      return subSchema;
    }
    Object.keys(subSchema.properties.triggers.properties).forEach(trigger => {
      subSchema.properties.triggers.properties[trigger].properties.options = true;
    });
    return subSchema;
  });
  return schema;
}

export const getApplier = (
  fs: FunctionService,
  engine: FunctionEngine,
  logs: LogService,
  validator: Validator
): DocumentChangeApplier => {
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;

        const overwriteSlug = fn => {
          if (change.resource_slug) {
            fn.name = change.resource_slug;
          }
        };

        switch (operationType) {
          case ChangeType.CREATE: {
            const fn: Function = YAML.parse(change.resource_content);
            overwriteSlug(fn);
            await validate(fn, validator);
            await CRUD.insert(fs, engine, fn).then(console.log);
            return {status: SyncStatuses.SUCCEEDED};
          }
          case ChangeType.UPDATE: {
            const fn: Function = YAML.parse(change.resource_content);
            const existing = await fs.findOne({name: change.resource_slug});
            if (existing) {
              fn._id = existing._id.toString();
            }
            overwriteSlug(fn);
            await validate(fn, validator);
            await CRUD.replace(fs, engine, fn);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.DELETE: {
            const existing = await fs.findOne({name: change.resource_slug});
            if (!existing) {
              return {status: SyncStatuses.FAILED, reason: "Function not found"};
            }
            await CRUD.remove(fs, engine, logs, existing._id.toString());
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
        logger.warn(`Error applying function change: ${(error as any).stack || String(error)}`);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
