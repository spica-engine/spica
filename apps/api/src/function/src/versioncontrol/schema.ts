import {ChangeStreamDocument, ObjectId} from "@spica-server/database";
import {FunctionService} from "@spica-server/function/services";
import {
  ChangeTypes,
  DocChange,
  RepChange,
  ResourceType,
  SynchronizerArgs,
  VCSynchronizerArgs
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
): VCSynchronizerArgs<Function, RepresentativeManagerResource> => {
  const moduleName = "function";
  const fileName = "schema";
  const extension = "yaml";

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
        .then(functions => {
          functions.forEach(fn => {
            const docChange: DocChange<Function> = {
              resourceType: ResourceType.DOCUMENT,
              changeType: ChangeTypes.INSERT,
              resource: fn
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

  const repApplier = (change: RepChange<RepresentativeManagerResource>) => {
    const write = (resource: RepresentativeManagerResource) =>
      vcRepresentativeManager.write(
        moduleName,
        resource._id,
        fileName,
        resource.content,
        extension
      );
    const rm = (resource: RepresentativeManagerResource) =>
      vcRepresentativeManager.rm(moduleName, resource._id);

    const representativeStrategy = {
      [ChangeTypes.INSERT]: write,
      [ChangeTypes.UPDATE]: write,
      [ChangeTypes.DELETE]: rm
    };

    representativeStrategy[change.changeType](change.resource);
  };

  const insert = async (fn: Function) => {
    fn = await CRUD.insert(fs, engine, fn);
    // check whether we really need to update index
    await engine.update(fn, "");
  };

  return {
    syncs: [
      {
        watcher: {
          service: fs
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
          insert: insert,
          update: (fn: Function) => CRUD.replace(fs, engine, fn),
          delete: (fn: Function) => CRUD.remove(fs, engine, logs, fn._id)
        }
      }
    ],
    moduleName,
    subModuleName: "schema"
  };
};
