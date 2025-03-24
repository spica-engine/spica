import {ObjectId} from "@spica-server/database";
import {FunctionService} from "@spica-server/function/services";
import {SyncProvider} from "@spica-server/versioncontrol";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/log/src/log.service";
import * as CRUD from "../crud";
import {IRepresentativeManager} from "@spica-server/interface/representative";

export function schemaSyncProviders(
  fs: FunctionService,
  manager: IRepresentativeManager,
  engine: FunctionEngine,
  logs: LogService
): SyncProvider {
  const name = "function-schema";
  const module = "function";

  const getAll = async () => {
    const fns = await fs.find();
    return fns.map(fn => {
      return {...fn, _id: fn._id.toString()};
    });
  };

  const insert = async fn => {
    fn = await CRUD.insert(fs, engine, fn);
    // check whether we really need to update index
    await engine.update(fn, "");
  };

  const update = fn => CRUD.replace(fs, engine, fn);

  const remove = fn => CRUD.remove(fs, engine, logs, fn._id);

  const document = {
    getAll,
    insert,
    update,
    delete: remove
  };

  const readAll = async () => {
    const resourceNameValidator = str => ObjectId.isValid(str);
    let files = await manager.read(module, resourceNameValidator, ["schema.yaml"]);

    return files.map(file => file.contents.schema);
  };

  const write = fn => {
    return Promise.all([manager.write(module, fn._id, "schema", fn, "yaml")]);
  };

  const rm = fn => {
    return manager.rm(module, fn._id);
  };

  const representative = {
    getAll: readAll,
    insert: write,
    update: write,
    delete: rm
  };

  return {
    name,
    document,
    representative,
    parents: 1
  };
}
