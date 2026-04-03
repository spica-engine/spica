import {FunctionService} from "@spica-server/function/services";
import {
  Dependency,
  EnvRelation,
  Function,
  FunctionWithDependencies,
  ChangeKind,
  SecretRelation
} from "@spica-server/interface/function";
import {changesFromTriggers, createTargetChanges, hasContextChange} from "./change";
import {ObjectId} from "@spica-server/database";
import {FunctionEngine} from "./engine";
import {LogService} from "@spica-server/function/log";
import {BadRequestException, InternalServerErrorException, NotFoundException} from "@nestjs/common";
import {FunctionPipelineBuilder} from "./pipeline.builder";
import fs from "fs";
import * as readline from "readline";

async function insertWithChanges(fs: FunctionService, engine: FunctionEngine, fn: Function) {
  if (fn._id) {
    fn._id = new ObjectId(fn._id);
  }

  let insertedFn;
  try {
    const r = await fs.insertOne(fn);
    insertedFn = await findOneForRuntime(fs, r._id);
  } catch (error: any) {
    if (error && error.code === 11000) {
      throw new BadRequestException(
        `Value of the property .${Object.keys(error.keyValue)[0]} should unique across all documents.`
      );
    }

    throw new InternalServerErrorException(error?.message || error);
  }

  const changes = createTargetChanges(insertedFn, ChangeKind.Added, engine.secretDecryptor);
  engine.categorizeChanges(changes);
}

export async function find<
  ER extends EnvRelation = EnvRelation.NotResolved,
  SR extends SecretRelation = SecretRelation.NotResolved
>(
  fs: FunctionService,
  engine: FunctionEngine,
  options?: {
    filter?: {
      resources?: object;
      envVars?: ObjectId[];
      index?: string;
      language?: string;
    };
    resolveEnvRelations?: ER;
    resolveSecretRelations?: SR;
  }
): Promise<Function<ER, SR>[]> {
  const pipeline = new FunctionPipelineBuilder()
    .filterResources(options?.filter?.resources)
    .filterByEnvVars(options?.filter?.envVars)
    .resolveEnvRelation(options?.resolveEnvRelations)
    .resolveSecretRelation(options?.resolveSecretRelations)
    .hideSecrets()
    .filterByLanguage(options?.filter?.language)
    .result();
  let fns = await fs.aggregate<Function<ER, SR>>(pipeline).toArray();

  if (options?.filter?.index) {
    fns = await index.filter(fns, options.filter.index, engine);
  }
  return fns;
}

export async function findOne<
  ER extends EnvRelation = EnvRelation.NotResolved,
  SR extends SecretRelation = SecretRelation.NotResolved
>(
  fs: FunctionService,
  id: ObjectId,
  options: {
    resolveEnvRelations?: ER;
    resolveSecretRelations?: SR;
  }
): Promise<Function<ER, SR>> {
  const pipeline = new FunctionPipelineBuilder()
    .findOneIfRequested(id)
    .resolveEnvRelation(options.resolveEnvRelations)
    .resolveSecretRelation(options.resolveSecretRelations)
    .hideSecrets()
    .result();

  const res = await fs.aggregate<Function<ER, SR>>(pipeline).next();
  if (!res) {
    throw new NotFoundException(`Couldn't find the function with id ${id}`);
  }

  return res;
}

export async function findByName<
  ER extends EnvRelation = EnvRelation.NotResolved,
  SR extends SecretRelation = SecretRelation.NotResolved
>(
  fs: FunctionService,
  name: string,
  options?: {resolveEnvRelations?: ER; resolveSecretRelations?: SR}
): Promise<Function<ER, SR> | null> {
  if (typeof name != "string" || name.trim() == "") {
    throw new BadRequestException("Function name must be a non-empty string.");
  }
  const fn = await fs.findOne({name});
  if (!fn) return null;
  if (options?.resolveEnvRelations || options?.resolveSecretRelations) {
    return findOne(fs, new ObjectId(fn._id), {
      resolveEnvRelations: options?.resolveEnvRelations,
      resolveSecretRelations: options?.resolveSecretRelations
    }) as Promise<Function<ER, SR>>;
  }
  return fn as Function<ER, SR>;
}

export async function insert(fs: FunctionService, engine: FunctionEngine, fn: Function) {
  await insertWithChanges(fs, engine, fn);
  await engine.createFunction(fn);
  return fn;
}

export async function insertSchema(fs: FunctionService, engine: FunctionEngine, fn: Function) {
  await insertWithChanges(fs, engine, fn);
  return fn;
}

export async function replace(fs: FunctionService, engine: FunctionEngine, fn: Function) {
  const _id = new ObjectId(fn._id);

  // not sure that is necessary
  delete fn._id;
  delete fn.language;

  const preFn = await fs.findOneAndUpdate({_id}, {$set: fn});
  if (!preFn) {
    throw new NotFoundException(`Couldn't find the function with id ${_id}`);
  }

  fn._id = _id;
  const currFnEnvResolved = await findOneForRuntime(fs, _id);

  let changes;

  if (hasContextChange(preFn, fn)) {
    // mark all triggers updated
    changes = createTargetChanges(currFnEnvResolved, ChangeKind.Updated, engine.secretDecryptor);
  } else {
    changes = changesFromTriggers(preFn, currFnEnvResolved, engine.secretDecryptor);
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

  const changes = createTargetChanges(fn, ChangeKind.Removed, engine.secretDecryptor);
  engine.categorizeChanges(changes);

  await engine.deleteFunction(fn);
}

export namespace index {
  export async function find(fs: FunctionService, engine: FunctionEngine, id: ObjectId) {
    const fn = await fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Can not find function.");
    }
    const index = await engine.read(fn, "index").catch(e => {
      if (e == "Not Found") {
        throw new NotFoundException("Index does not exist.");
      }
      throw new InternalServerErrorException(e);
    });
    return {index};
  }

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

    const envResolvedFn = await findOneForRuntime(fs, id);

    const changes = createTargetChanges(envResolvedFn, ChangeKind.Updated, engine.secretDecryptor);
    engine.categorizeChanges(changes);

    return engine.compile(fn);
  }

  export async function writeByName(
    fs: FunctionService,
    engine: FunctionEngine,
    name: string,
    content: string
  ) {
    const fn = await findByName(fs, name);
    if (!fn) {
      throw new NotFoundException(`Cannot find function with name ${name}.`);
    }
    return write(fs, engine, fn._id, content);
  }

  export async function filter(
    fns: Function<EnvRelation, SecretRelation>[],
    text: string,
    engine: FunctionEngine
  ): Promise<Function<EnvRelation, SecretRelation>[]> {
    const foundFns = [];
    const promises = fns.map(fn => {
      const entrypoint = engine.getFunctionBuildEntrypoint(fn);
      return doesFileIncludeText(entrypoint, text)
        .then(doesInclude => {
          if (doesInclude) {
            foundFns.push(fn);
          }
        })
        .catch(e => Promise.reject(`Failed to filter function by index, reason: ${e}`));
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
  export async function findOne(fs: FunctionService, engine: FunctionEngine, id: ObjectId) {
    const fn = await fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }
    return engine.getPackages(fn);
  }

  export async function install(engine: FunctionEngine, fn: Function, deps: Dependency | string[]) {
    if (!deps) {
      throw new BadRequestException("Dependency name is required.");
    }

    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }

    if (!Array.isArray(deps)) {
      deps = Object.entries(deps).map(([name, version]) => {
        return `${name}@${version}`;
      });
    }

    if (deps.length) {
      await engine.addPackage(fn, deps).toPromise();
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
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }

    await Promise.all(
      deps.map(dep =>
        engine.removePackage(fn, dep).catch(error => {
          throw new BadRequestException(error.message);
        })
      )
    );
  }

  export async function create(
    fs: FunctionService,
    engine: FunctionEngine,
    id: ObjectId,
    packageJson: any
  ) {
    const fn = await fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }
    await engine.createDependency(fn, packageJson);
    const FunctionWithDependencies = {
      ...fn,
      dependencies: packageJson.dependencies || {}
    };
    await dependencies.update(engine, FunctionWithDependencies);
  }

  export async function remove(fs: FunctionService, engine: FunctionEngine, id: ObjectId) {
    const fn = await fs.findOne({_id: id});
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }
    await engine.deleteDependency(fn);
    const existingDependencies = await engine.getPackages(fn);
    await dependencies.uninstall(
      engine,
      fn,
      existingDependencies.map(d => d.name)
    );
  }

  export async function writeAndInstall(
    fs: FunctionService,
    engine: FunctionEngine,
    name: string,
    deps: Dependency
  ) {
    const fn = await findByName(fs, name);
    if (!fn) {
      throw new NotFoundException(`Could not find the function with name ${name}.`);
    }
    await engine.writePackageJson(fn, deps);
    await engine.installFromPackageJson(fn).toPromise();
  }
}

export namespace environment {
  export async function inject(
    fs: FunctionService,
    fnId: ObjectId,
    engine: FunctionEngine,
    envVarId: ObjectId
  ) {
    const res = await fs.findOneAndUpdate(
      {
        _id: fnId
      },
      {
        $addToSet: {env_vars: envVarId}
      }
    );
    if (!res) {
      throw new NotFoundException(`Function with ID ${fnId} not found`);
    }

    return reload(fs, fnId, engine);
  }

  export async function eject(
    fs: FunctionService,
    fnId: ObjectId,
    engine: FunctionEngine,
    envVarId: ObjectId
  ) {
    const res = await fs.findOneAndUpdate(
      {
        _id: fnId
      },
      {
        $pull: {env_vars: envVarId}
      }
    );
    if (!res) {
      throw new NotFoundException(`Function with ID ${fnId} not found`);
    }

    return reload(fs, fnId, engine);
  }

  export async function reload(fs: FunctionService, fnId: ObjectId, engine: FunctionEngine) {
    const envResolvedFn = await findOneForRuntime(fs, fnId);
    const changes = createTargetChanges(envResolvedFn, ChangeKind.Updated, engine.secretDecryptor);
    return engine.categorizeChanges(changes);
  }
}

export namespace secret {
  export async function inject(
    fs: FunctionService,
    fnId: ObjectId,
    engine: FunctionEngine,
    secretId: ObjectId
  ) {
    const res = await fs.findOneAndUpdate(
      {
        _id: fnId
      },
      {
        $addToSet: {secrets: secretId}
      }
    );
    if (!res) {
      throw new NotFoundException(`Function with ID ${fnId} not found`);
    }

    return reload(fs, fnId, engine);
  }

  export async function eject(
    fs: FunctionService,
    fnId: ObjectId,
    engine: FunctionEngine,
    secretId: ObjectId
  ) {
    const res = await fs.findOneAndUpdate(
      {
        _id: fnId
      },
      {
        $pull: {secrets: secretId}
      }
    );
    if (!res) {
      throw new NotFoundException(`Function with ID ${fnId} not found`);
    }

    return reload(fs, fnId, engine);
  }

  export async function reload(fs: FunctionService, fnId: ObjectId, engine: FunctionEngine) {
    const fn = await findOneForRuntime(fs, fnId);
    const changes = createTargetChanges(fn, ChangeKind.Updated, engine.secretDecryptor);
    return engine.categorizeChanges(changes);
  }
}

export async function findOneForRuntime(
  fs: FunctionService,
  id: ObjectId
): Promise<Function<EnvRelation.Resolved, SecretRelation.Resolved>> {
  const pipeline = new FunctionPipelineBuilder()
    .findOneIfRequested(id)
    .resolveEnvRelation(EnvRelation.Resolved)
    .resolveSecretRelation(SecretRelation.Resolved)
    .result();

  const res = await fs
    .aggregate<Function<EnvRelation.Resolved, SecretRelation.Resolved>>(pipeline)
    .next();
  if (!res) {
    throw new NotFoundException(`Couldn't find the function with id ${id}`);
  }

  return res;
}

export async function findForRuntime(
  fs: FunctionService
): Promise<Function<EnvRelation.Resolved, SecretRelation.Resolved>[]> {
  const pipeline = new FunctionPipelineBuilder()
    .resolveEnvRelation(EnvRelation.Resolved)
    .resolveSecretRelation(SecretRelation.Resolved)
    .result();

  return fs.aggregate<Function<EnvRelation.Resolved, SecretRelation.Resolved>>(pipeline).toArray();
}
