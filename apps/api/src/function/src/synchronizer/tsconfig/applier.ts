import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {
  ChangeLog,
  ApplyResult,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";

const module = "function";
const subModule = "tsconfig";
const fileExtension = "json";

export const getApplier = (fs: FunctionService, engine: FunctionEngine): DocumentChangeApplier => {
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
      // no way to find fn by tsconfig content
      return Promise.resolve(null);
    },

    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        return {
          status: SyncStatuses.FAILED,
          reason: `tsconfig is read-only and changes cannot be applied.`
        };
      } catch (error) {
        console.warn("Error applying function tsconfig change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
