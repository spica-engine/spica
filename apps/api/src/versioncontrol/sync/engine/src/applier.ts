import {IRepresentativeManager} from "@spica-server/interface/representative";
import {
  ApplyResult,
  ChangeLog,
  ChangeType,
  DocumentChangeSupplier,
  RepresentativeChangeApplier,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";

export const getApplier = (
  repManager: IRepresentativeManager,
  supplier: DocumentChangeSupplier
): RepresentativeChangeApplier => {
  const {module, subModule} = supplier;
  return {
    module,
    subModule,
    apply: async (change: ChangeLog) => {
      let result: ApplyResult = {status: SyncStatuses.SUCCEEDED};
      try {
        if (change.type === ChangeType.DELETE) {
          await repManager.rm(module, change.resource_slug);
          return result;
        }

        await repManager.write(
          module,
          change.resource_slug,
          subModule,
          change.resource_content,
          change.resource_extension
        );
      } catch (error) {
        result = {status: SyncStatuses.FAILED, reason: (error as Error).message};
      }
      return result;
    }
  };
};
