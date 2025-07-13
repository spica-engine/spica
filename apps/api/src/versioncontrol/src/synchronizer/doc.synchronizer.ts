import {
  ChangeTypes,
  DocChange,
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
): SynchronizerArgs<R, RepresentativeManagerResource>["syncs"][0]["watcher"]["watch"] {
  if (props.docWatcher) {
    return props.docWatcher;
  }

  const service = props.collectionService;

  return () =>
    new Observable<DocChange<R>>(observer => {
      const changeStream = service._coll.watch([], {
        fullDocument: "updateLookup"
      });

      changeStream.on("change", (change: ChangeStreamDocument<R>) => {
        let changeType: ChangeTypes;
        let resource: R;

        switch (change.operationType) {
          case "insert":
            changeType = ChangeTypes.INSERT;
            resource = change.fullDocument!;
            break;

          case "replace":
          case "update":
            changeType = ChangeTypes.UPDATE;
            resource = change.fullDocument!;
            break;

          case "delete":
            changeType = ChangeTypes.DELETE;
            resource = {_id: change.documentKey._id} as unknown as R;
            break;

          default:
            return;
        }

        const docChange: DocChange<R> = {
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
            const docChange: DocChange<R> = {
              resourceType: ResourceType.DOCUMENT,
              changeType: ChangeTypes.INSERT,
              resource: resource as R
            };

            observer.next(docChange);
          });
        });

      return () => changeStream.close();
    });
}

export function getDocToRepConverter<R extends Resource>(
  props: VCSynchronizerArgs<R>["syncs"][0]["converter"]
): SynchronizerArgs<R, RepresentativeManagerResource>["syncs"][0]["converter"]["convert"] {
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
): SynchronizerArgs<R, RepresentativeManagerResource>["syncs"][0]["applier"]["apply"] {
  return change => {
    const write = (resource: RepresentativeManagerResource) => {
      return vcRepresentativeManager.write(
        moduleName,
        resource.displayableName || resource._id,
        props.fileName,
        resource.content,
        props.getExtension(change)
      );
    };

    const rm = async (resource: RepresentativeManagerResource) => {
      if (!resource.displayableName) {
        resource._id = await vcRepresentativeManager.findFolder(
          moduleName,
          resource._id.toString()
        );
        console.log(resource._id);
      }
      return vcRepresentativeManager.rm(moduleName, resource._id);
    };

    const representativeStrategy = {
      [ChangeTypes.INSERT]: write,
      [ChangeTypes.UPDATE]: write,
      [ChangeTypes.DELETE]: rm
    };

    return representativeStrategy[change.changeType](change.resource);
  };
}
