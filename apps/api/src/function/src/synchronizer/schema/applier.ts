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
  const findIdByName = async (name: string) => {
    const fn = await fs.findOne({name});
    return fn?._id?.toString();
  };
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    extractId: async (slug: string, content?: string): Promise<string | null> => {
      const id = await findIdByName(slug);
      if (id) return id;

      if (content) {
        let fn: Function;
        try {
          fn = YAML.parse(content);
        } catch (error) {
          logger.error("YAML parsing error:", error instanceof Error ? error.stack : String(error));
          return null;
        }
        return fn?._id ? String(fn._id) : null;
      }

      return null;
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;

        const overwritePrimaries = (change: ChangeLog, fn) => {
          if (change.resource_id) {
            fn._id = change.resource_id;
          }

          if (change.resource_slug) {
            fn.name = change.resource_slug;
          }
        };

        switch (operationType) {
          case ChangeType.CREATE: {
            const fn: Function = YAML.parse(change.resource_content);
            overwritePrimaries(change, fn);
            await validate(fn, validator);
            await CRUD.insert(fs, engine, fn);
            return {status: SyncStatuses.SUCCEEDED};
          }
          case ChangeType.UPDATE: {
            const fn: Function = YAML.parse(change.resource_content);
            overwritePrimaries(change, fn);
            await validate(fn, validator);
            await CRUD.replace(fs, engine, fn);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.DELETE:
            await CRUD.remove(fs, engine, logs, change.resource_id);
            return {status: SyncStatuses.SUCCEEDED};

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
