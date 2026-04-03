import {IRepresentativeManager} from "@spica-server/interface-representative";
import {
  ChangeInitiator,
  ChangeOrigin,
  DocumentChangeApplier,
  RepresentativeChangeSupplier
} from "@spica-server/interface-versioncontrol";
import {Observable, from, map, mergeMap, of, switchMap, timer} from "rxjs";

const MAX_RETRIES = 5;
const INITIAL_DELAY_SECONDS = 2;

const extractIdWithRetry = (
  extractId: (slug: string, content?: string) => Promise<string | null>,
  slug: string,
  content: string | undefined,
  retryIndex = 0
): Observable<string | null> =>
  from(extractId(slug, content)).pipe(
    mergeMap(id => {
      if (!!id || retryIndex >= MAX_RETRIES) {
        return of(id);
      }
      const delayMs = Math.pow(INITIAL_DELAY_SECONDS, retryIndex + 1) * 1000;
      return timer(delayMs).pipe(
        switchMap(() => extractIdWithRetry(extractId, slug, content, retryIndex + 1))
      );
    })
  );

export const getSupplier = (
  repManager: IRepresentativeManager,
  applier: DocumentChangeApplier
): RepresentativeChangeSupplier => {
  const {module, subModule, extractId, fileExtensions} = applier;
  return {
    module,
    subModule,
    listen: () => {
      const fileNames = fileExtensions.map(ext => `${subModule}.${ext}`);

      return repManager.watch(applier.module, fileNames).pipe(
        mergeMap(event =>
          extractIdWithRetry(extractId, event.slug, event.content).pipe(
            map(id => ({...event, _id: id}))
          )
        ),
        map(({_id, slug, content, type, extension, event_id}) => {
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
            initiator: ChangeInitiator.EXTERNAL,
            event_id
          };
        })
      );
    }
  };
};
