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
import {ChangeStreamDocument, ObjectId} from "mongodb";
import {Observable} from "rxjs";
import YAML from "yaml";
import * as CRUD from "../crud";
import {EnvVarService} from "@spica-server/env_var/services";
import {EnvVar} from "@spica-server/interface/env_var";

export const getSynchronizer = (
  evs: EnvVarService,
  vcRepresentativeManager: IRepresentativeManager
): SynchronizerArgs<EnvVar, RepresentativeManagerResource> => {
  const moduleName = "env-var";
  const file = "schema.yaml";

  const docWatcher = () => {
    return new Observable<DocChange<EnvVar>>(observer => {
      const changeStream = evs._coll.watch([], {
        fullDocument: "updateLookup"
      });

      changeStream.on("change", (change: ChangeStreamDocument<EnvVar>) => {
        let changeType: ChangeTypes;
        let resource: EnvVar;

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
            resource = {_id: change.documentKey._id} as EnvVar;
            break;

          default:
            return;
        }

        const docChange: DocChange<EnvVar> = {
          resourceType: ResourceType.DOCUMENT,
          changeType,
          resource
        };

        observer.next(docChange);
      });

      changeStream.on("error", err => observer.error(err));
      changeStream.on("close", () => observer.complete());

      evs._coll
        .find()
        .toArray()
        .then(envVars => {
          envVars.forEach(envVar => {
            const docChange: DocChange<EnvVar> = {
              resourceType: ResourceType.DOCUMENT,
              changeType: ChangeTypes.INSERT,
              resource: envVar
            };

            observer.next(docChange);
          });
        });

      return () => changeStream.close();
    });
  };

  const docToRepConverter = (
    change: DocChange<EnvVar>
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
      vcRepresentativeManager.writeFile(moduleName, resource._id, file, resource.content);
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

  const repWatcher = () => vcRepresentativeManager.watch(moduleName, [file]);

  const repToDocConverter = (
    change: RepChange<RepresentativeManagerResource>
  ): DocChange<EnvVar> => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};

    return {
      ...change,
      resourceType: ResourceType.DOCUMENT,
      resource: {...parsed, _id: new ObjectId(change.resource._id)}
    };
  };

  const docApplier = (change: DocChange<EnvVar>) => {
    const documentStrategy = {
      [ChangeTypes.INSERT]: (envVar: EnvVar) => CRUD.insert(evs, envVar),
      [ChangeTypes.UPDATE]: (envVar: EnvVar) => CRUD.replace(evs, envVar),
      [ChangeTypes.DELETE]: (envVar: EnvVar) => CRUD.remove(evs, envVar._id)
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
