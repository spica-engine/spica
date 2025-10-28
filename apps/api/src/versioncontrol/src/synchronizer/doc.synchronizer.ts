import {
  ChangeTypes,
  DocChange,
  DocumentManagerResource,
  RepChange,
  RepresentativeManagerResource,
  Resource,
  ResourceType,
  SynchronizerArgs,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import {ChangeStreamDocument} from "mongodb";
import {Observable} from "rxjs";
import YAML from "yaml";

export function getDocWatcher<R extends Resource>(
  props: VCSynchronizerArgs<R>["syncs"][0]["watcher"]
): SynchronizerArgs<
  DocumentManagerResource<R>,
  RepresentativeManagerResource
>["syncs"][0]["watcher"]["watch"] {
  if (props.docWatcher) {
    return props.docWatcher;
  }

  const service = props.collectionService;

  return () =>
    new Observable<DocChange<DocumentManagerResource<R>>>(observer => {
      const changeStream = service._coll.watch([], {
        fullDocument: "updateLookup"
      });

      changeStream.on("change", (change: ChangeStreamDocument<R>) => {
        let changeType: ChangeTypes;
        let resource: DocumentManagerResource<R>;

        switch (change.operationType) {
          case "insert":
            changeType = ChangeTypes.INSERT;
            resource = {
              _id: change.fullDocument!._id?.toString(),
              slug:
                change.fullDocument.name || change.fullDocument.title || change.fullDocument.key,
              content: change.fullDocument!
            };
            break;

          case "replace":
          case "update":
            changeType = ChangeTypes.UPDATE;
            resource = {
              _id: change.fullDocument!._id?.toString(),
              slug:
                change.fullDocument.name || change.fullDocument.title || change.fullDocument.key,
              content: change.fullDocument!
            };
            break;

          case "delete":
            changeType = ChangeTypes.DELETE;
            resource = {
              _id: change.documentKey._id?.toString(),
              content: {_id: change.documentKey._id} as unknown as R
            };
            break;

          default:
            return;
        }

        const docChange: DocChange<DocumentManagerResource<R>> = {
          resourceType: ResourceType.DOCUMENT,
          changeType,
          resource
        };

        observer.next(docChange);
      });

      changeStream.on("error", err => observer.error(err));
      changeStream.on("close", () => observer.complete());

      service._coll
        .find()
        .toArray()
        .then(resources => {
          resources.forEach(resource => {
            const docChange: DocChange<DocumentManagerResource<R>> = {
              resourceType: ResourceType.DOCUMENT,
              changeType: ChangeTypes.INSERT,
              resource: {
                _id: resource._id?.toString(),
                slug: resource.name || resource.title || resource.key,
                content: resource as R
              }
            };

            observer.next(docChange);
          });
        });

      return () => changeStream.close();
    });
}

export function getDocToRepConverter<R extends Resource>(
  props: VCSynchronizerArgs<R>["syncs"][0]["converter"]
): SynchronizerArgs<
  DocumentManagerResource<R>,
  RepresentativeManagerResource
>["syncs"][0]["converter"]["convert"] {
  return change => ({
    changeType: change.changeType,
    resourceType: ResourceType.REPRESENTATIVE,
    resource: props.convertToRepResource(change)
  });
}

export function getRepApplier<R extends Resource>(
  vcRepresentativeManager: VCRepresentativeManager,
  moduleName: VCSynchronizerArgs<R>["moduleName"],
  props: VCSynchronizerArgs<R>["syncs"][0]["applier"]
): SynchronizerArgs<
  DocumentManagerResource<R>,
  RepresentativeManagerResource
>["syncs"][0]["applier"]["apply"] {
  return change => {
    const write = (resource: RepresentativeManagerResource) => {
      return vcRepresentativeManager.write(
        moduleName,
        resource.slug,
        props.fileName,
        resource.content,
        props.getExtension(change),
        props.getAccessMode?.(change)
      );
    };

    const rm = async (resource: RepresentativeManagerResource) => {
      const id = resource.slug;
      return vcRepresentativeManager.rm(moduleName, id);
    };

    const representativeStrategy = {
      [ChangeTypes.INSERT]: write,
      [ChangeTypes.UPDATE]: write,
      [ChangeTypes.DELETE]: rm
    };

    return representativeStrategy[change.changeType](change.resource);
  };
}
