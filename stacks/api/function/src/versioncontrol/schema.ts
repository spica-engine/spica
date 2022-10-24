import {ObjectId} from "@spica-server/database";
import {FunctionService} from "@spica-server/function/services";
import {IRepresentativeManager, SyncProvider} from "@spica-server/versioncontrol";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/src/log/src/log.service";
import * as CRUD from "../crud";

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

    files = putActualEnvs(files);

    return files.map(file => file.contents.schema);
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

export function putActualEnvs(files) {
  for (const file of files) {
    const placeholders = file.contents.schema.env || {};
    const actualEnvs = file.contents.env || {};

    for (const [key, value] of Object.entries<string>(placeholders)) {
      const match = /{(.*?)}/gm.exec(value);

      let replacedValue = value;
      if (match && match.length && Object.keys(actualEnvs).includes(match[1])) {
        replacedValue = file.contents.env[match[1]];
      }

      file.contents.schema.env[key] = replacedValue;
    }
  }
  return files;
}
