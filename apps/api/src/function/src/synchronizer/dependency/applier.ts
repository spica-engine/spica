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
import {findFunctionBySlugWithRetry} from "../retry";

const logger = new Logger("FunctionDepSyncApplier");

const module = "function";
const subModule = "package";
const fileExtension = "json";

export const getApplier = (fs: FunctionService, engine: FunctionEngine): DocumentChangeApplier => {
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],

    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;
        let fn;
        let packageJson;

        switch (operationType) {
          case ChangeType.CREATE:
          case ChangeType.UPDATE:
            // let schema generated first
            await new Promise(resolve => setTimeout(resolve, 2000));
            fn = await fs.findOne({name: change.resource_slug});
            packageJson = JSON.parse(change.resource_content);
            const fnWithDeps = {
              ...fn,
              dependencies: packageJson.dependencies || {}
            };
            await CRUD.dependencies.update(engine, fnWithDeps);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            // await CRUD.dependencies.remove(fs, engine, fn._id);
            return {status: SyncStatuses.SUCCEEDED};

          default:
            logger.warn(`Unknown operation type: ${operationType}`);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        logger.warn(
          `Error applying function dependency change: ${(error as any).stack || String(error)}`
        );
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
