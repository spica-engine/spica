import {FunctionService} from "@spica-server/function/services";
import {
  Dependency,
  EnvRelation,
  Function,
  FunctionWithDependencies
} from "@spica-server/interface/function";
import {ChangeKind, changesFromTriggers, createTargetChanges, hasContextChange} from "./change";
import {ObjectId} from "@spica-server/database";
import {FunctionEngine} from "./engine";
import {LogService} from "@spica-server/function/log";
import {NotFoundException} from "@nestjs/common";
import {FunctionPipelineBuilder} from "./pipeline.builder";

export function find<ER extends EnvRelation = EnvRelation.NotResolved>(
  fs: FunctionService,
  options: {
    resourceFilter?: object;
    resolveEnvRelations?: ER;
    envVars?: ObjectId[];
  }
): Promise<Function<ER>[]> {
  const pipeline = new FunctionPipelineBuilder()
    .filterResources(options.resourceFilter)
    .filterByEnvVars(options.envVars)
    .resolveEnvRelation(options.resolveEnvRelations)
    .result();
  return fs.aggregate<Function<ER>>(pipeline).toArray();
}

export function findOne<ER extends EnvRelation = EnvRelation.NotResolved>(
  fs: FunctionService,
  options: {
    id: ObjectId;
    resolveEnvRelations?: ER;
  }
): Promise<Function<ER>> {
  const pipeline = new FunctionPipelineBuilder()
    .findOneIfRequested(options.id)
    .resolveEnvRelation(options.resolveEnvRelations)
    .result();
  return fs.aggregate<Function<ER>>(pipeline).next();
}

export async function insert(fs: FunctionService, engine: FunctionEngine, fn: Function) {
  if (fn._id) {
    fn._id = new ObjectId(fn._id);
  }

  const insertedFn = await fs
    .insertOne(fn)
    .then(r => findOne(fs, {id: r._id, resolveEnvRelations: EnvRelation.Resolved}));

  const changes = createTargetChanges(insertedFn, ChangeKind.Added);
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
  const currFnEnvResolved = await findOne(fs, {id: _id, resolveEnvRelations: EnvRelation.Resolved});

  let changes;

  if (hasContextChange(preFn, fn)) {
    // mark all triggers updated
    changes = createTargetChanges(currFnEnvResolved, ChangeKind.Updated);
  } else {
    changes = changesFromTriggers(preFn, currFnEnvResolved);
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

    const envResolvedFn = await findOne(fs, {id, resolveEnvRelations: EnvRelation.Resolved});

    const changes = createTargetChanges(envResolvedFn, ChangeKind.Updated);
    engine.categorizeChanges(changes);

    return engine.compile(fn);
  }
}

export namespace dependencies {
  export async function install(engine: FunctionEngine, fn: Function, deps: Dependency) {
    const newDeps = Object.entries(deps).map(([name, version]) => {
      return `${name}@${(version as string).slice(1)}`;
    });

    if (newDeps.length) {
      await engine.addPackage(fn, newDeps).toPromise();
    }
  }

  export async function update(engine: FunctionEngine, fn: FunctionWithDependencies) {
    const oldDependencies = await engine.getPackages(fn);
    const newDependencies = {...fn.dependencies};

    for (let [name, version] of Object.entries(newDependencies)) {
      const existingIndex = oldDependencies.findIndex(
        dep => dep.name == name && dep.version == version
      );

      if (existingIndex != -1) {
        oldDependencies.splice(existingIndex, 1);
        delete newDependencies[name];
      }
    }

    await dependencies.uninstall(
      engine,
      fn,
      oldDependencies.map(d => d.name)
    );
    await dependencies.install(engine, fn, newDependencies);

    return fn;
  }

  export async function uninstall(engine: FunctionEngine, fn: Function, deps: string[]) {
    await Promise.all(deps.map(dep => engine.removePackage(fn, dep)));
  }
}

export namespace environment {
  export async function inject(
    fs: FunctionService,
    fnId: ObjectId,
    engine: FunctionEngine,
    envVarId: ObjectId
  ) {
    await fs.findOneAndUpdate(
      {
        _id: fnId
      },
      {
        $addToSet: {env_vars: envVarId}
      }
    );

    return reload(fs, fnId, engine);
  }

  export async function eject(
    fs: FunctionService,
    fnId: ObjectId,
    engine: FunctionEngine,
    envVarId: ObjectId
  ) {
    await fs.findOneAndUpdate(
      {
        _id: fnId
      },
      {
        $pull: {env_vars: envVarId}
      }
    );

    return reload(fs, fnId, engine);
  }

  export async function reload(fs: FunctionService, fnId: ObjectId, engine: FunctionEngine) {
    const envResolvedFn = await findOne(fs, {
      id: fnId,
      resolveEnvRelations: EnvRelation.Resolved
    });
    const changes = createTargetChanges(envResolvedFn, ChangeKind.Updated);
    return engine.categorizeChanges(changes);
  }

  export function apply(fn: Function, env: object) {
    const placeholders = fn.env_vars || {};
    const actualEnvs = env || {};

    for (const [key, value] of Object.entries<string>(placeholders)) {
      const match = /{(.*?)}/gm.exec(value);

      let replacedValue = value;
      if (match && match.length && Object.keys(actualEnvs).includes(match[1])) {
        replacedValue = actualEnvs[match[1]];
      }

      fn.env_vars[key] = replacedValue;
    }
    return fn;
  }
}
