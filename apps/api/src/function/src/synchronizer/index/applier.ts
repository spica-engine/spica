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
            for (let attempt = 1; attempt <= 5; attempt++) {
              try {
                await CRUD.index.writeByName(
                  fs,
                  engine,
                  change.resource_slug,
                  change.resource_content
                );
                return {status: SyncStatuses.SUCCEEDED};
              } catch (error) {
                logger.warn(
                  `Attempt ${attempt} - Error applying function index change: ${
                    (error as any).stack || String(error)
                  }`
                );
                if (attempt === 5) {
                  return {status: SyncStatuses.FAILED, reason: error.message};
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              }
            }
            break;
          case ChangeType.DELETE:
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
