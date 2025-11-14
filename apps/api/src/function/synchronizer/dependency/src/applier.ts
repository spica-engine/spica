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
const subModule = "package";
const fileExtension = "json";

export const applier = (fs: FunctionService, engine: FunctionEngine): DocumentChangeApplier => {
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
      let name;
      try {
        name = JSON.parse(content).name;
      } catch (error) {
        console.warn("Error parsing function package content:", error);
        return Promise.resolve(null);
      }
      return findFnByName(name);
    },

    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;

        switch (operationType) {
          case ChangeType.CREATE:
          case ChangeType.UPDATE:
            const func = await CRUD.findOne(fs, new ObjectId(change.resource_id), {});
            const packageJson = JSON.parse(change.resource_content);
            const fnWithDeps = {
              ...func,
              dependencies: packageJson.dependencies || {}
            };
            await CRUD.dependencies.update(engine, fnWithDeps);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            const fn = await CRUD.findOne(fs, new ObjectId(change.resource_id), {});
            await engine.deleteDependency(fn);
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
        console.warn("Error applying function dependency change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
