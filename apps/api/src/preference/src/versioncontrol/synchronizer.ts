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
import {Observable} from "rxjs";
import YAML from "yaml";

export const getSynchronizer = (
  prefService: PreferenceService,
  vcRepresentativeManager: IRepresentativeManager
): VCSynchronizerArgs<Preference, RepresentativeManagerResource> => {
  const moduleName = "preference";
  const fileName = "schema";
  const extension = "yaml";

  const docWatcher = () => {
    return new Observable<DocChange<Preference>>(observer => {
      const changeStream = prefService._coll.watch([], {
        fullDocument: "updateLookup"
      });

      changeStream.on("change", (change: ChangeStreamDocument<Preference>) => {
        let changeType: ChangeTypes;
        let resource: Preference;

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
            resource = {_id: change.documentKey._id} as Preference;
            break;

          default:
            return;
        }

        const docChange: DocChange<Preference> = {
          resourceType: ResourceType.DOCUMENT,
          changeType,
          resource
        };

        observer.next(docChange);
      });

      changeStream.on("error", err => observer.error(err));
      changeStream.on("close", () => observer.complete());

      prefService._coll
        .find()
        .toArray()
        .then((preferences: WithId<Preference>[]) => {
          preferences.forEach(preference => {
            const docChange: DocChange<Preference> = {
              resourceType: ResourceType.DOCUMENT,
              changeType: ChangeTypes.INSERT,
              resource: preference
            };

            observer.next(docChange);
          });
        });

      return () => changeStream.close();
    });
  };

  const docToRepConverter = (
    change: DocChange<Preference>
  ): RepChange<RepresentativeManagerResource> => {
    return {
      ...change,
      resourceType: ResourceType.REPRESENTATIVE,
      resource: {
        _id: change.resource._id.toString(),
        content: YAML.stringify(change.resource)
      }
    };
  };

  const repApplier = (change: RepChange<RepresentativeManagerResource>) => {
    const write = (resource: RepresentativeManagerResource) => {
      vcRepresentativeManager.write(
        moduleName,
        resource._id,
        fileName,
        resource.content,
        extension
      );
    };

    const rm = (resource: RepresentativeManagerResource) => {
      vcRepresentativeManager.rm(moduleName, resource._id);
    };

    const representativeStrategy = {
      [ChangeTypes.INSERT]: write,
      [ChangeTypes.UPDATE]: write,
      [ChangeTypes.DELETE]: rm
    };

    representativeStrategy[change.changeType](change.resource);
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
