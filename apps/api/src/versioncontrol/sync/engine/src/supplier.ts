import {IRepresentativeManager} from "@spica-server/interface/representative";
import {
  ChangeInitiator,
  ChangeOrigin,
  DocumentChangeApplier,
  RepresentativeChangeSupplier
} from "@spica-server/interface/versioncontrol";
import {from, map, mergeMap, of} from "rxjs";

export const getSupplier = (
  repManager: IRepresentativeManager,
  applier: DocumentChangeApplier
): RepresentativeChangeSupplier => {
  const {module, subModule, findIdBySlug, findIdByContent, fileExtensions} = applier;
  return {
    module,
    subModule,
    listen: () => {
      const fileNames = fileExtensions.map(ext => `${subModule}.${ext}`);

      const mergeId = event => map(id => ({...event, _id: id}));
      const attachIdFromSlug = event => from(findIdBySlug(event.slug)).pipe(mergeId(event));
      const attachIdFromContent = event =>
        event._id ? of(event) : from(findIdByContent(event.content)).pipe(mergeId(event));

      return repManager.watch(applier.module, fileNames).pipe(
        mergeMap(attachIdFromSlug),
        mergeMap(attachIdFromContent),
        map(({_id, slug, content, type, extension}) => {
          return {
            module,
            sub_module: subModule,
            origin: ChangeOrigin.REPRESENTATIVE,
            created_at: new Date(),
            resource_content: content,
            resource_slug: slug,
            resource_id: _id,
            resource_extension: extension,
            type,
            initiator: ChangeInitiator.EXTERNAL
          };
        })
      );
    }
  };
};
