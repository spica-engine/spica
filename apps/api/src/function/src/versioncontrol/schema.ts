import {ChangeStreamDocument, ObjectId} from "@spica-server/database";
import {FunctionService} from "@spica-server/function/services";
import {
  ChangeTypes,
  DocChange,
  RepChange,
  ResourceType,
  SynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/log/src/log.service";
import * as CRUD from "../crud";
import {
  IRepresentativeManager,
  RepresentativeManagerResource
} from "@spica-server/interface/representative";
import {Function} from "@spica-server/interface/function";
import {Observable} from "rxjs";
import YAML from "yaml";

export const getSchemaSynchronizer = (
  fs: FunctionService,
  vcRepresentativeManager: IRepresentativeManager,
  engine: FunctionEngine,
  logs: LogService
): SynchronizerArgs<Function, RepresentativeManagerResource> => {
  const moduleName = "function";

  const docWatcher = () => {
    return new Observable<DocChange<Function>>(observer => {
      const changeStream = fs._coll.watch([], {
        fullDocument: "updateLookup"
      });

      changeStream.on("change", (change: ChangeStreamDocument<Function>) => {
        let changeType: ChangeTypes;
        let resource: Function;

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
            resource = {_id: change.documentKey._id} as Function;
            break;

          default:
            return;
        }

        const docChange: DocChange<Function> = {
          resourceType: ResourceType.DOCUMENT,
          changeType,
          resource
        };

        observer.next(docChange);
      });

      changeStream.on("error", err => observer.error(err));
      changeStream.on("close", () => observer.complete());

      fs._coll
        .find()
        .toArray()
        .then(buckets => {
          buckets.forEach(bucket => {
            const docChange: DocChange<Function> = {
              resourceType: ResourceType.DOCUMENT,
              changeType: ChangeTypes.INSERT,
              resource: bucket
            };

            observer.next(docChange);
          });
        });

      return () => changeStream.close();
    });
  };

  const docToRepConverter = (
    change: DocChange<Function>
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

  const file = "schema.yaml";

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

  const repWatcher = () => vcRepresentativeManager.watch(moduleName, file);

  const repToDocConverter = (
    change: RepChange<RepresentativeManagerResource>
  ): DocChange<Function> => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};

    return {
      changeType: change.changeType,
      resourceType: ResourceType.DOCUMENT,
      resource: {...parsed, _id: new ObjectId(change.resource._id)}
    };
  };

  const docApplier = (change: DocChange<Function>) => {
    const insert = async (fn: Function) => {
      fn = await CRUD.insert(fs, engine, fn);
      // check whether we really need to update index
      await engine.update(fn, "");
    };

    const documentStrategy = {
      [ChangeTypes.INSERT]: insert,
      [ChangeTypes.UPDATE]: (fn: Function) => CRUD.replace(fs, engine, fn),
      [ChangeTypes.DELETE]: (fn: Function) => CRUD.remove(fs, engine, logs, fn._id)
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
