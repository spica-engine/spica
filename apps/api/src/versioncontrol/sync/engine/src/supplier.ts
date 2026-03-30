import {IRepresentativeManager} from "@spica-server/interface/representative";
import {
  ChangeInitiator,
  ChangeOrigin,
  DocumentChangeApplier,
  RepresentativeChangeSupplier
} from "@spica-server/interface/versioncontrol";
import {map} from "rxjs";

export const getSupplier = (
  repManager: IRepresentativeManager,
  applier: DocumentChangeApplier
): RepresentativeChangeSupplier => {
  const {module, subModule, fileExtensions} = applier;
  return {
    module,
    subModule,
    listen: () => {
      const fileNames = fileExtensions.map(ext => `${subModule}.${ext}`);

      return repManager.watch(applier.module, fileNames).pipe(
        map(({slug, content, type, extension, event_id}) => {
          return {
            module,
            sub_module: subModule,
            origin: ChangeOrigin.REPRESENTATIVE,
            created_at: new Date(),
            resource_content: content,
            resource_slug: slug,
            resource_extension: extension,
            type,
            initiator: ChangeInitiator.EXTERNAL,
            event_id
          };
        })
      );
    }
  };
};
