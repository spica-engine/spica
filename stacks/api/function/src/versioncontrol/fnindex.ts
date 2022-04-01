import {ObjectId} from "@spica-server/database";
import {FunctionService} from "@spica-server/function/services";
import {IRepresentativeManager, SyncProvider} from "@spica-server/versioncontrol";
import {ChangeKind, createTargetChanges} from "../change";
import {FunctionEngine} from "../engine";

export function indexSyncProviders(
  service: FunctionService,
  manager: IRepresentativeManager,
  engine: FunctionEngine
): SyncProvider {
  const module = "function";

  const getAll = async () => {
    const fns = await service.find();
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

  const insert = async fn => {
    const index = fn.index;
    fn = await service.findOne({_id: new ObjectId(fn._id)});

    await engine.update(fn, index).catch(console.log);

    const changes = createTargetChanges(fn, ChangeKind.Updated);
    engine.categorizeChanges(changes);

    return engine.compile(fn);
  };

  // we can not remove index because it can break the function
  const rm = () => Promise.resolve();

  const document = {
    module,
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
    module,
    getAll: readAll,
    insert: write,
    update: write,
    delete: rm
  };

  return {
    document,
    representative
  };
}
