import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {LogService} from "@spica-server/function/log";
import * as CRUD from "../../../src/crud";
import {Function} from "@spica-server/interface/function";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeApplier,
  ApplyResult,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";

const module = "function";
const subModule = "schema";
const fileExtension = "yaml";

export const applier = (
  fs: FunctionService,
  engine: FunctionEngine,
  logs: LogService
): ChangeApplier => {
  return {
    module,
    subModule,
    fileExtension,
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;
        const fn: Function = YAML.parse(change.resource_content);

        switch (operationType) {
          case ChangeType.CREATE:
            await CRUD.insert(fs, engine, fn);
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
