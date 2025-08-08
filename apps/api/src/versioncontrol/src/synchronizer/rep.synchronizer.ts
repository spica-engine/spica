import {
  ChangeTypes,
  RepresentativeManagerResource,
  Resource,
  ResourceType,
  SynchronizerArgs,
  VCSynchronizerArgs
} from "../../../../../../libs/interface/versioncontrol";
import {VCRepresentativeManager} from "../../../../../../libs/representative";

export function getRepWatcher<R extends Resource>(
  vcRepresentativeManager: VCRepresentativeManager,
  moduleName: VCSynchronizerArgs<R>["moduleName"],
  props: VCSynchronizerArgs<R>["syncs"][1]["watcher"]
): SynchronizerArgs<R, RepresentativeManagerResource>["syncs"][1]["watcher"]["watch"] {
  const filesToWatch = props.filesToWatch.map(file => `${file.name}.${file.extension}`);
  return () => vcRepresentativeManager.watch(moduleName, filesToWatch, props?.eventsToWatch);
}

export function getRepToDocConverter<R extends Resource>(
  props: VCSynchronizerArgs<R>["syncs"][1]["converter"]
): SynchronizerArgs<R, RepresentativeManagerResource>["syncs"][1]["converter"]["convert"] {
  return change => ({
    changeType: change.changeType,
    resourceType: ResourceType.DOCUMENT,
    resource: props.convertToDocResource(change)
  });
}

export function getDocApplier<R extends Resource>(
  props: VCSynchronizerArgs<R>["syncs"][1]["applier"]
): SynchronizerArgs<R, RepresentativeManagerResource>["syncs"][1]["applier"]["apply"] {
  return async change => {
    const documentStrategy = {
      [ChangeTypes.INSERT]: props.insert,
      [ChangeTypes.UPDATE]: props.update,
      [ChangeTypes.DELETE]: props.delete
    };

    await documentStrategy[change.changeType](change.resource);
  };
}
