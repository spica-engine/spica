import {Preference} from "@spica-server/interface/preference";
import {
  IRepresentativeManager,
  RepresentativeManagerResource
} from "@spica-server/interface/representative";
import {
  ChangeTypes,
  DocChange,
  RepChange,
  ResourceType,
  SynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {PreferenceService} from "@spica-server/preference/services";
import {ObjectId} from "mongodb";
import {map, Observable} from "rxjs";
import YAML from "yaml";

export const getSynchronizer = (
  prefService: PreferenceService,
  vcRepresentativeManager: IRepresentativeManager
): SynchronizerArgs<Preference, RepresentativeManagerResource> => {
  const moduleName = "preference";
  const fileName = "schema";
  const extension = "yaml";

  const docWatcher = (): Observable<DocChange<Preference>> => {
    return prefService.watch("passport", {propagateOnStart: true}).pipe(
      map((preference: Preference) => ({
        resourceType: ResourceType.DOCUMENT,
        changeType: ChangeTypes.UPDATE,
        resource: preference
      }))
    );
  };

  const docToRepConverter = (
    change: DocChange<Preference>
  ): RepChange<RepresentativeManagerResource> => {
    return {
      changeType: change.changeType,
      resourceType: ResourceType.REPRESENTATIVE,
      resource: {
        _id: change.resource._id.toString(),
        content: YAML.stringify(change.resource)
      }
    };
  };

  const repApplier = (change: RepChange<RepresentativeManagerResource>) => {
    vcRepresentativeManager.write(
      moduleName,
      change.resource._id,
      fileName,
      change.resource.content,
      extension
    );
  };

  const repWatcher = () => vcRepresentativeManager.watch(moduleName, [`${fileName}.${extension}`]);

  const repToDocConverter = (
    change: RepChange<RepresentativeManagerResource>
  ): DocChange<Preference> => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};

    return {
      ...change,
      resourceType: ResourceType.DOCUMENT,
      resource: {...parsed, _id: new ObjectId(change.resource._id)}
    };
  };

  const docApplier = (change: DocChange<Preference>) => {
    const upsert = (preference: Preference) => {
      delete preference._id;
      return prefService.updateOne(
        {scope: "passport"},
        {$set: {identity: preference}},
        {upsert: true}
      );
    };

    const remove = async () => {
      await prefService.updateOne(
        {scope: "passport"},
        {
          $set: {
            identity: {
              attributes: {}
            }
          }
        }
      );
    };

    const documentStrategy = {
      [ChangeTypes.INSERT]: upsert,
      [ChangeTypes.UPDATE]: upsert,
      [ChangeTypes.DELETE]: remove
    };

    documentStrategy[change.changeType](change.resource);
  };

  return {
    syncs: [
      {
        watcher: {
          resourceType: ResourceType.DOCUMENT,
          watch: docWatcher
        },
        converter: {
          convert: docToRepConverter
        },
        applier: {
          resourceType: ResourceType.REPRESENTATIVE,
          apply: repApplier
        }
      },
      {
        watcher: {
          resourceType: ResourceType.REPRESENTATIVE,
          watch: repWatcher
        },
        converter: {
          convert: repToDocConverter
        },
        applier: {
          resourceType: ResourceType.DOCUMENT,
          apply: docApplier
        }
      }
    ],
    moduleName,
    subModuleName: "schema"
  };
};
