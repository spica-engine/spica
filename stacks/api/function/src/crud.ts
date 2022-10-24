import {FunctionService} from "@spica-server/function/services";
import {Dependency, Function, FunctionWithDependencies} from "@spica-server/interface/function";
import {ChangeKind, changesFromTriggers, createTargetChanges, hasContextChange} from "./change";
import {ObjectId} from "@spica-server/database";
import {FunctionEngine} from "./engine";
import {LogService} from "@spica-server/function/src/log";
import {NotFoundException} from "@nestjs/common";

export async function insert(fs: FunctionService, engine: FunctionEngine, fn: Function) {
  if (fn._id) {
    fn._id = new ObjectId(fn._id);
  }

  fn = await fs.insertOne(fn);

  const changes = createTargetChanges(fn, ChangeKind.Added);
  engine.categorizeChanges(changes);

  await engine.createFunction(fn);
  return fn;
}

export async function replace(fs: FunctionService, engine: FunctionEngine, fn: Function) {
  const _id = new ObjectId(fn._id);

  // not sure that is necessary
  delete fn._id;

  delete fn.language;

  const preFn = await fs.findOneAndUpdate({_id}, {$set: fn});

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
}

export async function remove(
  fs: FunctionService,
  engine: FunctionEngine,
  logs: LogService,
  id: ObjectId | string
) {
  const fn = await fs.findOneAndDelete({_id: new ObjectId(id)});

  if (!fn) {
    throw new NotFoundException("Couldn't find the function.");
  }

  logs.deleteMany({function: fn._id.toString()});

  const changes = createTargetChanges(fn, ChangeKind.Removed);
  engine.categorizeChanges(changes);

  await engine.deleteFunction(fn);
}

export namespace index {
  export async function write(
    fs: FunctionService,
    engine: FunctionEngine,
    id: string | ObjectId,
    index: string
  ) {
    id = new ObjectId(id);

    const fn = await fs.findOne({_id: id});

    if (!fn) {
      throw new NotFoundException("Cannot find function.");
    }

    await engine.update(fn, index);

    const changes = createTargetChanges(fn, ChangeKind.Updated);
    engine.categorizeChanges(changes);

    return engine.compile(fn);
  }
}

export namespace dependencies {
  export async function reinstall(engine: FunctionEngine, fn: FunctionWithDependencies) {
    await dependencies.uninstall(engine, fn);

    const newDeps = Object.entries(fn.dependencies).map(([name, version]) => {
      return `${name}@${(version as string).slice(1)}`;
    });

    await engine.addPackage(fn, newDeps).toPromise();

    return fn;
  }

  export async function uninstall(engine: FunctionEngine, fn: Function) {
    const deps = await engine.getPackages(fn);
    await Promise.all(deps.map(dep => engine.removePackage(fn, dep.name)));
  }
}
