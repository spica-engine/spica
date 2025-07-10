import {FunctionService} from "@spica-server/function/services";
import {
  DocChange,
  getIdForDocToRepConverter,
  RepChange,
  RepresentativeManagerResource,
  VCSynchronizerArgs
} from "@spica-server/interface/versioncontrol";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/log/src/log.service";
import * as CRUD from "../crud";
import {Function} from "@spica-server/interface/function";
import YAML from "yaml";
import {ObjectId} from "bson";

export const getSchemaSynchronizer = (
  fs: FunctionService,
  engine: FunctionEngine,
  logs: LogService
): VCSynchronizerArgs<Function> => {
  const fileName = "schema";
  const extension = "yaml";

  const convertToRepResource = (change: DocChange<Function>) => ({
    _id: getIdForDocToRepConverter(change, change.resource.name),
    content: YAML.stringify(change.resource)
  });

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};
    return {...parsed, _id: new ObjectId(change.resource._id)};
  };

  const insert = async (fn: Function) => {
    fn = await CRUD.insert(fs, engine, fn);
    // check whether we really need to update index
    await engine.update(fn, "");
  };

  return {
    syncs: [
      {
        watcher: {collectionService: fs},
        converter: {convertToRepResource},
        applier: {fileName, getExtension: () => extension}
      },
      {
        watcher: {filesToWatch: [{name: fileName, extension}]},
        converter: {convertToDocResource},
        applier: {
          insert: insert,
          update: (fn: Function) => CRUD.replace(fs, engine, fn),
          delete: (fn: Function) => CRUD.remove(fs, engine, logs, fn._id)
        }
      }
    ],
    moduleName: "function",
    subModuleName: "schema"
  };
};
