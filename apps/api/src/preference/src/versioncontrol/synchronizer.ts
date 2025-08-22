import {Identity} from "@spica-server/interface/passport/identity";
import {Preference} from "@spica-server/interface/preference";
import {
  ChangeTypes,
  DocChange,
  RepChange,
  RepresentativeManagerResource,
  ResourceType,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {PreferenceService} from "@spica-server/preference/services";
import {map, Observable} from "rxjs";
import YAML from "yaml";

export const getSynchronizer = (
  prefService: PreferenceService
): VCSynchronizerArgs<Identity["attributes"]> => {
  const fileName = "schema";
  const extension = "yaml";

  const docWatcher = (): Observable<DocChange<Identity["attributes"]>> => {
    return prefService.watch("passport", {propagateOnStart: true}).pipe(
      map((preference: Preference) => ({
        resourceType: ResourceType.DOCUMENT,
        changeType: ChangeTypes.UPDATE,
        resource: {...preference.identity, _id: "identity"}
      }))
    );
  };

  const convertToRepResource = (change: DocChange<Identity["attributes"]>) => {
    const {_id, ...resourceWithoutID} = change.resource;
    return {_id, slug: _id, content: YAML.stringify(resourceWithoutID)};
  };

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) => {
    return change.resource.content ? YAML.parse(change.resource.content) : {};
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
        converter: {convertToRepResource},
        applier: {fileName, getExtension: () => extension}
      },
      {
        watcher: {filesToWatch: [{name: fileName, extension}]},
        converter: {convertToDocResource},
        applier: {insert: upsert, update: upsert, delete: remove}
      }
    ],
    moduleName: "preference",
    subModuleName: "schema"
  };
};
