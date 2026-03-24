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
import {ObjectId} from "bson";
import {Logger} from "@nestjs/common";

const logger = new Logger("FunctionIdxSyncApplier");

const module = "function";
const subModule = "index";
const fileExtensions = ["mjs", "ts"];

export const getApplier = (fs: FunctionService, engine: FunctionEngine): DocumentChangeApplier => {
  const findFnByName = async (name: string) => {
    const fn = await fs.findOne({name});
    return fn?._id?.toString();
  };
  return {
    module,
    subModule,
    fileExtensions,
    findIdBySlug: (slug: string): Promise<string> => {
      return findFnByName(slug);
    },
    findIdByContent: (content: string): Promise<string> => {
      // no way to find fn by index content
      return Promise.resolve(null);
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;

        let resourceId = change.resource_id;
        if (!resourceId && change.resource_slug) {
          resourceId = await findFnByName(change.resource_slug);
        }

        if (!resourceId) {
          return {
            status: SyncStatuses.FAILED,
            reason: `Cannot resolve function for slug: ${change.resource_slug}`
          };
        }

        switch (operationType) {
          case ChangeType.CREATE:
          case ChangeType.UPDATE:
            await CRUD.index.write(fs, engine, resourceId, change.resource_content);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            const fn = await CRUD.findOne(fs, new ObjectId(resourceId), {});
            await engine.deleteIndex(fn);
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
