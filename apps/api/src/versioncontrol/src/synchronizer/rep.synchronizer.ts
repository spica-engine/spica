import {
  ChangeTypes,
  DocumentManagerResource,
  RepresentativeManagerResource,
  Resource,
  ResourceType,
  SynchronizerArgs,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";

export function getRepWatcher<R extends Resource>(
  vcRepresentativeManager: VCRepresentativeManager,
  moduleName: VCSynchronizerArgs<R>["moduleName"],
  props: VCSynchronizerArgs<R>["syncs"][1]["watcher"]
): SynchronizerArgs<
  DocumentManagerResource<R>,
  RepresentativeManagerResource
>["syncs"][1]["watcher"]["watch"] {
  const filesToWatch = props.filesToWatch.map(file => `${file.name}.${file.extension}`);
  return () => vcRepresentativeManager.watch(moduleName, filesToWatch, props?.eventsToWatch);
}

export function getRepToDocConverter<R extends Resource>(
  props: VCSynchronizerArgs<R>["syncs"][1]["converter"]
): SynchronizerArgs<
  DocumentManagerResource<R>,
  RepresentativeManagerResource
>["syncs"][1]["converter"]["convert"] {
  return change => ({
    changeType: change.changeType,
    resourceType: ResourceType.DOCUMENT,
    resource: {
      _id: change.resource._id,
      slug: change.resource.slug,
      content: props.convertToDocResource(change)
    }
  });
}

export function getDocApplier<R extends Resource>(
  props: VCSynchronizerArgs<R>["syncs"][1]["applier"]
): SynchronizerArgs<
  DocumentManagerResource<R>,
  RepresentativeManagerResource
>["syncs"][1]["applier"]["apply"] {
  return async change => {
    const documentStrategy = {
      [ChangeTypes.INSERT]: props.insert,
      [ChangeTypes.UPDATE]: props.update,
      [ChangeTypes.DELETE]: props.delete
    };

    await documentStrategy[change.changeType](change.resource.content);
  };
}
