import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import * as CRUD from "../../../src/crud";
import {
  ChangeLog,
  ApplyResult,
  ChangeType,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";
import {Logger} from "@nestjs/common";

const logger = new Logger("FunctionIdxSyncApplier");

const module = "function";
const subModule = "index";
const fileExtensions = ["mjs", "ts"];

export const getApplier = (fs: FunctionService, engine: FunctionEngine): DocumentChangeApplier => {
  return {
    module,
    subModule,
    fileExtensions,
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;

        switch (operationType) {
          case ChangeType.CREATE:
          case ChangeType.UPDATE:
            console.log("Applying function index change for", change);
            // let schema generated first
            await new Promise(resolve => setTimeout(resolve, 2000));
            const fn = await fs.findOne({name: change.resource_slug});
            console.log("Function found for index update:", fn);
            await CRUD.index.write(fs, engine, fn._id, change.resource_content);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            // const fn = await findFunctionBySlugWithRetry(fs, change.resource_slug);
            // await engine.deleteIndex(fn);
            return {
              status: SyncStatuses.SUCCEEDED
            };

          default:
            logger.warn(`Unknown operation type: ${operationType}`);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        logger.warn(
          `Error applying function index change: ${(error as any).stack || String(error)}`
        );
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
