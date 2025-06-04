import {
  ChangeTypes,
  RepresentativeManagerResource,
  Resource,
  ResourceType,
  SynchronizerArgs,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {VCRepresentativeManager} from "@spica-server/representative";
import {ObjectId} from "bson";
import YAML from "yaml";

export function getRepWatcher<R extends Resource>(
  vcRepresentativeManager: VCRepresentativeManager,
  moduleName: VCSynchronizerArgs<R>["moduleName"],
  props?: VCSynchronizerArgs<R>["syncs"][1]["watcher"]
): SynchronizerArgs<R, RepresentativeManagerResource>["syncs"][1]["watcher"]["watch"] {
  const filesToWatch = props
    ? props.filesToWatch.map(file => `${file.name}.${file.extension}`)
    : ["schema.yaml"];

  return () => vcRepresentativeManager.watch(moduleName, filesToWatch, props?.eventsToWatch);
}

export function getRepToDocConverter<R extends Resource>(
  props: VCSynchronizerArgs<R>["syncs"][1]["converter"]
): SynchronizerArgs<R, RepresentativeManagerResource>["syncs"][1]["converter"]["convert"] {
  return change => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};

    const _id = props.notObjectID ? change.resource._id : new ObjectId(change.resource._id);

    const documentResource = {...parsed, _id};
    const fileResource = {_id, content: change.resource.content};

    const resource = props.resourceType == "document" ? documentResource : fileResource;

    return {
      changeType: change.changeType,
      resourceType: ResourceType.DOCUMENT,
      resource
    };
  };
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
