import {FunctionService} from "@spica-server/function/services";
import {VCSynchronizerArgs} from "@spica-server/interface/versioncontrol";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/log/src/log.service";
import * as CRUD from "../crud";
import {Function} from "@spica-server/interface/function";

export const getSchemaSynchronizer = (
  fs: FunctionService,
  engine: FunctionEngine,
  logs: LogService
): VCSynchronizerArgs<Function> => {
  const insert = async (fn: Function) => {
    fn = await CRUD.insert(fs, engine, fn);
    // check whether we really need to update index
    await engine.update(fn, "");
  };

  return {
    syncs: [
      {
        watcher: {collectionService: fs}
      },
      {
        converter: {resourceType: "document"},
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
