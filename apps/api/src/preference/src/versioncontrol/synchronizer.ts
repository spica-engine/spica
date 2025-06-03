import {Preference} from "@spica-server/interface/preference";
import {
  ChangeTypes,
  DocChange,
  ResourceType,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {PreferenceService} from "@spica-server/preference/services";
import {ObjectId} from "bson";
import {map, Observable} from "rxjs";

export const getSynchronizer = (prefService: PreferenceService): VCSynchronizerArgs<Preference> => {
  const docWatcher = (): Observable<DocChange<Preference>> => {
    return prefService.watch("passport", {propagateOnStart: true}).pipe(
      map((preference: Preference) => ({
        resourceType: ResourceType.DOCUMENT,
        changeType: ChangeTypes.UPDATE,
        resource: {...preference, _id: new ObjectId(preference._id)}
      }))
    );
  };

  const upsert = (preference: Preference) => {
    delete preference._id;
    prefService.updateOne({scope: "passport"}, {$set: {identity: preference}}, {upsert: true});
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

  return {
    syncs: [
      {
        watcher: {docWatcher}
      },
      {
        converter: {resourceType: "document"},
        applier: {insert: upsert, update: upsert, delete: remove}
      }
    ],
    moduleName: "preference",
    subModuleName: "schema"
  };
};
