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
