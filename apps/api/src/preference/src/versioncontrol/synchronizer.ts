import {Identity} from "@spica-server/interface/passport/identity";
import {Preference} from "@spica-server/interface/preference";
import {
  ChangeTypes,
  DocChange,
  ResourceType,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {PreferenceService} from "@spica-server/preference/services";
import {map, Observable} from "rxjs";

export const getSynchronizer = (
  prefService: PreferenceService
): VCSynchronizerArgs<Identity["attributes"]> => {
  const docWatcher = (): Observable<DocChange<Identity["attributes"]>> => {
    return prefService.watch("passport", {propagateOnStart: true}).pipe(
      map((preference: Preference) => ({
        resourceType: ResourceType.DOCUMENT,
        changeType: ChangeTypes.UPDATE,
        resource: {...preference.identity, _id: "identity"}
      }))
    );
  };

  const upsert = (identityAttributes: Identity["attributes"]) => {
    delete identityAttributes._id;
    prefService.updateOne(
      {scope: "passport"},
      {$set: {identity: identityAttributes}},
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

  return {
    syncs: [
      {
        watcher: {docWatcher},
        converter: {withoutID: true}
      },
      {
        converter: {resourceType: "document", notObjectID: true},
        applier: {insert: upsert, update: upsert, delete: remove}
      }
    ],
    moduleName: "preference",
    subModuleName: "schema"
  };
};
