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
import fs from "fs";
import * as readline from "readline";

export async function find<ER extends EnvRelation = EnvRelation.NotResolved>(
  fs: FunctionService,
  engine: FunctionEngine,
  options?: {
    filter?: {
      resources?: object;
      envVars?: ObjectId[];
      index?: string;
    };
    resolveEnvRelations?: ER;
  }
): Promise<Function<ER>[]> {
  const pipeline = new FunctionPipelineBuilder()
    .filterResources(options?.filter?.resources)
    .filterByEnvVars(options?.filter?.envVars)
    .resolveEnvRelation(options?.resolveEnvRelations)
    .result();
  let fns = await fs.aggregate<Function<ER>>(pipeline).toArray();

  if (options?.filter?.index) {
    fns = await index.filter(fns, options.filter.index, engine);
  }
  return fns;
}

export function findOne<ER extends EnvRelation = EnvRelation.NotResolved>(
  fs: FunctionService,
  id: ObjectId,
  options: {
    resolveEnvRelations?: ER;
  }
): Promise<Function<ER>> {
  const pipeline = new FunctionPipelineBuilder()
    .findOneIfRequested(id)
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
    .then(r => findOne(fs, r._id, {resolveEnvRelations: EnvRelation.Resolved}));

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
  const currFnEnvResolved = await findOne(fs, _id, {resolveEnvRelations: EnvRelation.Resolved});

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

    const envResolvedFn = await findOne(fs, id, {resolveEnvRelations: EnvRelation.Resolved});

    const changes = createTargetChanges(envResolvedFn, ChangeKind.Updated);
    engine.categorizeChanges(changes);

    return engine.compile(fn);
  }

  export async function filter(
    fns: Function<EnvRelation>[],
    text: string,
    engine: FunctionEngine
  ): Promise<Function<EnvRelation>[]> {
    const foundFns = [];
    const promises = fns.map(fn => {
      const entrypoint = engine.getFunctionBuildEntrypoint(fn);
      return doesFileIncludeText(entrypoint, text).then(doesInclude => {
        if (doesInclude) {
          foundFns.push(fn);
        }
      });
    });
    return Promise.all(promises).then(() => foundFns);
  }

  function doesFileIncludeText(filePath: string, text: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let isFound = false;
      const regex = new RegExp(text);

      const stream = fs.createReadStream(filePath, {encoding: "utf8"});
      const rl = readline.createInterface({input: stream});

      stream.on("error", e => {
        rl.close();
        reject(e);
      });

      rl.on("line", line => {
        if (regex.test(line)) {
          isFound = true;
          rl.close();
        }
      });

      rl.on("close", () => resolve(isFound));
    });
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
    const envResolvedFn = await findOne(fs, fnId, {
      resolveEnvRelations: EnvRelation.Resolved
    });
    const changes = createTargetChanges(envResolvedFn, ChangeKind.Updated);
    return engine.categorizeChanges(changes);
  }
}
