import {BaseCollection} from "@spica-server/database";
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
  SynchronizerArgs,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {PreferenceService} from "@spica-server/preference/services";
import {ChangeStreamDocument, ObjectId, WithId} from "mongodb";
import {map, Observable} from "rxjs";
import YAML from "yaml";

export const getSynchronizer = (
  prefService: PreferenceService,
  vcRepresentativeManager: IRepresentativeManager
): VCSynchronizerArgs<Preference, RepresentativeManagerResource> => {
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
        watcher: {
          service: prefService as unknown as BaseCollection<Preference>
        }
        // converter: {
        //   convert: docToRepConverter
        // },
        // applier: {
        //   resourceType: ResourceType.REPRESENTATIVE,
        //   apply: repApplier
        // }
      },
      {
        watcher: {
          filesToWatch: [{name: fileName, extension}]
        },
        converter: {
          resourceType: "document"
        },
        applier: {
          insert: upsert,
          update: upsert,
          delete: remove
        }
      }
    ],
    moduleName,
    subModuleName: "schema"
  };
};
