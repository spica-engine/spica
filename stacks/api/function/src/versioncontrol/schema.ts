import {ObjectId} from "@spica-server/database";
import {FunctionService} from "@spica-server/function/services";
import {IRepresentativeManager, SyncProvider} from "@spica-server/versioncontrol";
import {ChangeKind, changesFromTriggers, createTargetChanges, hasContextChange} from "../change";
import {FunctionEngine} from "../engine";
import {LogService} from "@spica-server/function/src/log/src/log.service";

export function schemaSyncProviders(
  service: FunctionService,
  manager: IRepresentativeManager,
  engine: FunctionEngine,
  logs: LogService
): SyncProvider {
  const name = "function-schema";
  const module = "function";

  const getAll = async () => {
    const fns = await service.find();
    return fns.map(fn => {
      return {...fn, _id: fn._id.toString()};
    });
  };

  const insert = async fn => {
    fn._id = new ObjectId(fn._id);

    fn = await service.insertOne(fn);

    const changes = createTargetChanges(fn, ChangeKind.Added);
    engine.categorizeChanges(changes);

    await engine.createFunction(fn);
    await engine.update(fn, "");

    return fn;
  };

  const update = async fn => {
    const _id = new ObjectId(fn._id);

    delete fn._id;
    delete fn.language;

    const preFn = await service.findOneAndUpdate({_id}, {$set: fn});

    fn._id = _id;

    let changes;

    if (hasContextChange(preFn, fn)) {
      // mark all triggers updated
      changes = createTargetChanges(fn, ChangeKind.Updated);
    } else {
      changes = changesFromTriggers(preFn, fn);
    }

    engine.categorizeChanges(changes);

    return fn;
  };

  const remove = async fn => {
    fn = await service.findOneAndDelete({_id: new ObjectId(fn._id)});

    logs.deleteMany({function: fn._id.toString()});

    const changes = createTargetChanges(fn, ChangeKind.Removed);
    engine.categorizeChanges(changes);

    await engine.deleteFunction(fn);
  };

  const document = {
    getAll,
    insert,
    update,
    delete: remove
  };

  const readAll = async () => {
    const resourceNameValidator = str => ObjectId.isValid(str);
    const files = await manager.read(module, resourceNameValidator, ["schema.yaml"]);
    return files.map(file => file.contents.schema);
  };

  const write = fn => {
    return manager.write(module, fn._id, "schema", fn, "yaml");
  };

  const rm = fn => {
    return manager.delete(module, fn._id);
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
    representative
  };
}
