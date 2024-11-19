import {ObjectId} from "@spica/database";
import {FunctionService} from "@spica/api/src/function/services";
import {SyncProvider} from "@spica/api/src/versioncontrol";
import {FunctionEngine} from "../engine";
import * as CRUD from "../crud";
import {IRepresentativeManager} from "@spica/interface";

export function indexSyncProviders(
  fs: FunctionService,
  manager: IRepresentativeManager,
  engine: FunctionEngine
): SyncProvider {
  const name = "function-index";
  const module = "function";

  const getAll = async () => {
    const fns = await fs.find();
    const promises = [];

    const indexes = [];
    for (const fn of fns) {
      const promise = engine.read(fn).then(index => {
        indexes.push({_id: fn._id.toString(), index});
      });

      promises.push(promise);
    }

    return Promise.all(promises).then(() => indexes);
  };

  const insert = fn => CRUD.index.write(fs, engine, fn._id, fn.index);

  // we can not remove index because it can break the function
  const rm = () => Promise.resolve();

  const document = {
    getAll,
    insert,
    update: insert,
    delete: rm
  };

  const readAll = async () => {
    const resourceNameValidator = str => ObjectId.isValid(str);
    const files = await manager.read(module, resourceNameValidator, ["index.js", "index.ts"]);
    return files.map(file => {
      return {_id: file._id, index: file.contents.index};
    });
  };

  const write = fn => {
    const extension = fn.language == "javascript" ? "js" : "ts";
    return manager.write(module, fn._id.toString(), "index", fn.index, extension);
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
