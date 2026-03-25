import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {
  ChangeLog,
  ApplyResult,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";
import {Logger} from "@nestjs/common";

const logger = new Logger("FunctionTsconfigSyncApplier");

const module = "function";
const subModule = "tsconfig";
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
      return {
        status: SyncStatuses.FAILED,
        reason: `tsconfig is read-only and changes cannot be applied.`
      };
    }
  };
};
