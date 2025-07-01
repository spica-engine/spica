import {FunctionService} from "@spica-server/function/services";
import {
  DocChange,
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
    name: change.resource.name,
    content: YAML.stringify(change.resource)
  });

  const convertToDocResource = (change: RepChange<RepresentativeManagerResource>) => {
    const parsed = change.resource.content ? YAML.parse(change.resource.content) : {};
    return {...parsed, name: change.resource.name};
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
          delete: (fn: Function) => {
            CRUD.removeByName(fs, engine, logs, fn.name);
          }
        }
      }
    ],
    moduleName: "function",
    subModuleName: "schema"
  };
};
