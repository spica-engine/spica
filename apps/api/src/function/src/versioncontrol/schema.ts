import {ObjectId} from "@spica/database";
import {FunctionService} from "@spica/api/src/function/services";
import {SyncProvider} from "@spica/api/src/versioncontrol";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica/api/src/function/src/log/src/log.service";
import * as CRUD from "../crud";
import {IRepresentativeManager} from "@spica/interface";

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
    let files = await manager.read(module, resourceNameValidator, ["schema.yaml", "env.env"]);

    return files.map(file => CRUD.environment.apply(file.contents.schema, file.contents.env));
  };

  const write = fn => {
    const env = JSON.parse(JSON.stringify(fn.env || {}));
    for (const key of Object.keys(env)) {
      fn.env[key] = `{${key}}`;
    }

    return Promise.all([
      manager.write(module, fn._id, "schema", fn, "yaml"),
      manager.write(module, fn._id, "env", env, "env")
    ]);
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
    parents: 0
  };
}
