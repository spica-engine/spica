import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import * as CRUD from "../../../src/crud.js";
import {
  ChangeLog,
  ApplyResult,
  ChangeType,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";
import {ObjectId} from "bson";
import {Logger} from "@nestjs/common";

const logger = new Logger("FunctionDepSyncApplier");

const module = "function";
const subModule = "package";
const fileExtension = "json";

export const getApplier = (fs: FunctionService, engine: FunctionEngine): DocumentChangeApplier => {
  const findIdByName = async (name: string) => {
    const fn = await fs.findOne({name});
    return fn?._id?.toString();
  };
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    extractId: async (slug: string, content?: string): Promise<string | null> => {
      return findIdByName(slug);
    },

    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;
        const fn = await CRUD.findOne(fs, new ObjectId(change.resource_id), {});
        const packageJson = JSON.parse(change.resource_content);

        switch (operationType) {
          case ChangeType.CREATE:
            await CRUD.dependencies.create(fs, engine, fn._id, packageJson);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.UPDATE:
            const fnWithDeps = {
              ...fn,
              dependencies: packageJson.dependencies || {}
            };
            await CRUD.dependencies.update(engine, fnWithDeps);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            await CRUD.dependencies.remove(fs, engine, fn._id);
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
