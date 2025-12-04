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

const module = "function";
const subModule = "schema";
const fileExtension = "yaml";

export const getApplier = (
  fs: FunctionService,
  engine: FunctionEngine,
  logs: LogService
): DocumentChangeApplier => {
  const findFnByName = async (name: string) => {
    const fn = await fs.findOne({name});
    return fn?._id?.toString();
  };
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    findIdBySlug: (slug: string): Promise<string> => {
      return findFnByName(slug);
    },
    findIdByContent: (content: string): Promise<string> => {
      let fn: Function;
      try {
        fn = YAML.parse(content);
      } catch (error) {
        console.error("YAML parsing error:", error);
        return Promise.resolve(null);
      }
      return findFnByName(fn.name);
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;
        const fn: Function = YAML.parse(change.resource_content);

        switch (operationType) {
          case ChangeType.CREATE:
            await CRUD.insertSchema(fs, engine, fn);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.UPDATE:
            await CRUD.replace(fs, engine, fn);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            await CRUD.remove(fs, engine, logs, change.resource_id);
            return {status: SyncStatuses.SUCCEEDED};

          default:
            console.warn("Unknown operation type:", operationType);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        console.warn("Error applying function change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
