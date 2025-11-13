import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import * as CRUD from "../../../src/crud";
import {
  ChangeLog,
  ChangeApplier,
  ApplyResult,
  ChangeType,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import {ObjectId} from "bson";

const module = "function";
const subModule = "index";
const fileExtension = "js";

export const applier = (fs: FunctionService, engine: FunctionEngine): ChangeApplier => {
  return {
    module,
    subModule,
    fileExtension,
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;

        switch (operationType) {
          case ChangeType.CREATE:
          case ChangeType.UPDATE:
            await CRUD.index.write(fs, engine, change.resource_id, change.resource_content);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            const fn = await CRUD.findOne(fs, new ObjectId(change.resource_id), {});
            await engine.deleteIndex(fn);
            return {
              status: SyncStatuses.SUCCEEDED
            };

          default:
            console.warn("Unknown operation type:", operationType);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        console.warn("Error applying function index change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
