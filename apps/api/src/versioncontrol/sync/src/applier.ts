import {IIRepresentativeManager} from "@spica-server/interface/representative";
import {
  ApplyResult,
  ChangeLog,
  DocumentChangeSupplier,
  RepresentativeChangeApplier,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";

export const getApplier = (
  repManager: IIRepresentativeManager,
  supplier: DocumentChangeSupplier
): RepresentativeChangeApplier => {
  const {module, subModule, getFileExtension} = supplier;
  return {
    module,
    subModule,
    apply: async (change: ChangeLog) => {
      const fileExtension = await getFileExtension(change);
      let result: ApplyResult = {status: SyncStatuses.SUCCEEDED};
      try {
        await repManager.write(
          module,
          change.resource_slug,
          subModule,
          change.resource_content,
          fileExtension
        );
      } catch (error) {
        result = {status: SyncStatuses.FAILED, reason: (error as Error).message};
      }
      return result;
    }
  };
};
