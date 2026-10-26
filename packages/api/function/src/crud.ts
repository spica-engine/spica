import {SecretService} from "@spica-server/secret-services";
import {
  Dependency,
  EnvRelation,
  Function,
  FunctionRepository,
  FunctionWithDependencies,
  SecretRelation
} from "@spica-server/interface-function";
import {createPlan, refreshPlan, secretRefreshPlan} from "./change.js";
import {DuplicateKeyError, ids} from "@spica-server/data";
import {CollectionQueryFacade, Id} from "@spica-server/interface-data";
import {FunctionEngine} from "./engine.js";
import {LogRepository} from "@spica-server/interface-function-log";
import {BadRequestException, InternalServerErrorException, NotFoundException} from "@nestjs/common";
import fs from "fs";
import * as readline from "readline";

const collection = "function";

export const functionIds = () => ids().forCollection(collection);

const HIDDEN_SECRET_VALUES = {"secrets.value": 0} as const;

function relations(env: EnvRelation, secret: SecretRelation): string[] {
  return [
    ...(env == EnvRelation.Resolved ? ["env_vars"] : []),
    ...(secret == SecretRelation.Resolved ? ["secrets"] : [])
  ];
}

async function insertWithChanges(
  functions: FunctionRepository,
  engine: FunctionEngine,
  fn: Function
) {
  if (fn._id) {
    fn._id = functionIds().parse(fn._id);
  }

  try {
    const r = await functions.insert(fn);
    fn._id = r._id;
  } catch (error: any) {
    throw toWriteException(error);
  }

  await engine.applyChangePlan(createPlan(null, fn));
}

function toWriteException(error: any) {
  if (error instanceof DuplicateKeyError) {
    return new BadRequestException(
      `Value of the property .${Object.keys(error.keyValue)[0]} should unique across all documents.`
    );
  }
  return new InternalServerErrorException(error?.message || error);
}

export async function find<
  ER extends EnvRelation = EnvRelation.NotResolved,
  SR extends SecretRelation = SecretRelation.NotResolved
>(
  queries: CollectionQueryFacade,
  engine: FunctionEngine,
  options?: {
    filter?: {
      resources?: object;
      index?: string;
    };
    resolveEnvRelations?: ER;
    resolveSecretRelations?: SR;
  }
): Promise<Function<ER, SR>[]> {
  let fns = await queries.find<Function<ER, SR>>(collection, {
    resourceFilter: options?.filter?.resources,
    relations: relations(options?.resolveEnvRelations, options?.resolveSecretRelations),
    fields: HIDDEN_SECRET_VALUES
  });

  if (options?.filter?.index) {
    fns = await index.filter(fns, options.filter.index, engine);
  }
  return fns;
}

export async function findOne<
  ER extends EnvRelation = EnvRelation.NotResolved,
  SR extends SecretRelation = SecretRelation.NotResolved
>(
  queries: CollectionQueryFacade,
  id: Id,
  options: {
    resolveEnvRelations?: ER;
    resolveSecretRelations?: SR;
  }
): Promise<Function<ER, SR>> {
  const res = await queries.findOne<Function<ER, SR>>(collection, {
    id,
    relations: relations(options.resolveEnvRelations, options.resolveSecretRelations),
    fields: HIDDEN_SECRET_VALUES
  });
  if (!res) {
    throw new NotFoundException(`Couldn't find the function with id ${id}`);
  }

  return res;
}

export async function findByName<
  ER extends EnvRelation = EnvRelation.NotResolved,
  SR extends SecretRelation = SecretRelation.NotResolved
>(
  functions: FunctionRepository,
  queries: CollectionQueryFacade,
  name: string,
  options?: {resolveEnvRelations?: ER; resolveSecretRelations?: SR}
): Promise<Function<ER, SR> | null> {
  if (typeof name != "string" || name.trim() == "") {
    throw new BadRequestException("Function name must be a non-empty string.");
  }
  const fn = await functions.findByName(name);
  if (!fn) return null;
  if (options?.resolveEnvRelations || options?.resolveSecretRelations) {
    return findOne(queries, functionIds().parse(fn._id), {
      resolveEnvRelations: options?.resolveEnvRelations,
      resolveSecretRelations: options?.resolveSecretRelations
    }) as Promise<Function<ER, SR>>;
  }
  return fn as Function<ER, SR>;
}

export async function insert(functions: FunctionRepository, engine: FunctionEngine, fn: Function) {
  await insertWithChanges(functions, engine, fn);
  await engine.storeAssets(fn as Function & {_id: any}, "package.json", async () => {
    await engine.createFunction(fn);
    const pkgContent = await engine.read(fn, "dependency");
    return Buffer.from(pkgContent, "utf-8");
  });

  return fn;
}

export async function replace(functions: FunctionRepository, engine: FunctionEngine, fn: Function) {
  const _id = functionIds().parse(fn._id);

  // not sure that is necessary
  delete fn._id;
  delete fn.language;

  const preFn = await functions.updateById(_id, fn).catch(error => {
    throw toWriteException(error);
  });
  if (!preFn) {
    throw new NotFoundException(`Couldn't find the function with id ${_id}`);
  }

  fn._id = _id;

  if (preFn.name != fn.name) {
    await engine.moveAssets(preFn, fn.name).catch(async error => {
      await functions.replaceById(_id, preFn);
      throw new InternalServerErrorException(
        `Failed to move the files of function ${preFn.name} to ${fn.name}: ${error?.message || error}`
      );
    });
  }

  await engine.applyChangePlan(createPlan(preFn, fn));

  return fn;
}

export async function remove(
  functions: FunctionRepository,
  engine: FunctionEngine,
  logs: LogRepository,
  id: Id | string
) {
  const fn = await functions.deleteById(functionIds().parse(id));

  if (!fn) {
    throw new NotFoundException("Couldn't find the function.");
  }

  logs.deleteByFunction(fn._id.toString());

  await engine.applyChangePlan(createPlan(fn, null));

  await engine.deleteFunction(fn);
  await engine.removeAssets(fn as Function & {_id: any});
}

export namespace index {
  export async function find(functions: FunctionRepository, engine: FunctionEngine, id: Id) {
    const fn = await functions.findById(id);
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
    functions: FunctionRepository,
    engine: FunctionEngine,
    id: string | Id,
    index: string
  ) {
    id = functionIds().parse(id);

    const fn = await functions.findById(id);

    if (!fn) {
      throw new NotFoundException("Cannot find function.");
    }

    await engine.storeAssets(fn as Function & {_id: any}, engine.getIndexFilename(fn), async () => {
      await engine.update(fn, index);
      await engine.build(fn);
      return Buffer.from(index, "utf-8");
    });

    await engine.refreshWithDependents(fn);
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
  export async function findOne(functions: FunctionRepository, engine: FunctionEngine, id: Id) {
    const fn = await functions.findById(id);
    if (!fn) {
      throw new NotFoundException("Could not find the function.");
    }
    return engine.getPackages(fn);
  }

  async function storeDependencyAssets(
    engine: FunctionEngine,
    fn: Function,
    change: () => Promise<void>
  ) {
    await engine.storeAssets(fn as Function & {_id: any}, "package.json", async () => {
      await change();
      const pkgContent = await engine.read(fn, "dependency");
      return Buffer.from(pkgContent, "utf-8");
    });

    const lockfile = await engine.readLockfile(fn);
    if (lockfile) {
      await engine.storeAssets(
        fn as Function & {_id: any},
        "package-lock.json",
        async () => lockfile
      );
    }
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
      await storeDependencyAssets(engine, fn, () => engine.installPackages(fn, deps as string[]));
      await engine.refreshWithDependents(fn);
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

    await storeDependencyAssets(engine, fn, async () => {
      await Promise.all(
        deps.map(dep =>
          engine.removePackage(fn, dep).catch(error => {
            throw new BadRequestException(error.message);
          })
        )
      );
    });

    await engine.refreshWithDependents(fn);
  }
}

export namespace environment {
  export async function inject(
    functions: FunctionRepository,
    fnId: Id,
    engine: FunctionEngine,
    envVarId: Id
  ) {
    const res = await functions.addEnvVar(fnId, envVarId);
    if (!res) {
      throw new NotFoundException(`Function with ID ${fnId} not found`);
    }

    return reload(fnId, engine);
  }

  export async function removeReference(functions: FunctionRepository, fnId: Id, envVarId: Id) {
    const res = await functions.removeEnvVar(fnId, envVarId);
    if (!res) {
      throw new NotFoundException(`Function with ID ${fnId} not found`);
    }
  }

  export async function eject(
    functions: FunctionRepository,
    fnId: Id,
    engine: FunctionEngine,
    envVarId: Id
  ) {
    await removeReference(functions, fnId, envVarId);
    return reload(fnId, engine);
  }

  export async function reload(fnId: Id, engine: FunctionEngine) {
    return engine.applyChangePlan(refreshPlan(fnId.toString()));
  }
}

export namespace secret {
  export async function inject(
    functions: FunctionRepository,
    ss: SecretService,
    fnId: Id,
    engine: FunctionEngine,
    secretId: Id
  ) {
    const fn = await functions.addSecret(fnId, secretId);
    if (!fn) {
      throw new NotFoundException(`Function with ID ${fnId} not found`);
    }

    return reload(fn, ss, engine, secretId);
  }

  export async function removeReference(functions: FunctionRepository, fnId: Id, secretId: Id) {
    const fn = await functions.removeSecret(fnId, secretId);
    if (!fn) {
      throw new NotFoundException(`Function with ID ${fnId} not found`);
    }
    return fn;
  }

  export async function eject(
    functions: FunctionRepository,
    ss: SecretService,
    fnId: Id,
    engine: FunctionEngine,
    secretId: Id
  ) {
    const fn = await removeReference(functions, fnId, secretId);
    return reload(fn, ss, engine, secretId);
  }

  async function reload(fn: Function, ss: SecretService, engine: FunctionEngine, secretId: Id) {
    const secret = await ss.findOne({_id: secretId}, {projection: {key: 1}});
    const secretKeys = secret ? [secret.key] : [];
    return engine.applyChangePlan(secretRefreshPlan(fn, secretKeys));
  }
}

export async function findOneForRuntime(
  queries: CollectionQueryFacade,
  id: Id
): Promise<Function<EnvRelation.Resolved, SecretRelation.Resolved>> {
  const res = await queries.findOne<Function<EnvRelation.Resolved, SecretRelation.Resolved>>(
    collection,
    {id, relations: relations(EnvRelation.Resolved, SecretRelation.Resolved)}
  );
  if (!res) {
    throw new NotFoundException(`Couldn't find the function with id ${id}`);
  }

  return res;
}

export function findWithSecrets(
  queries: CollectionQueryFacade,
  ids: Id[]
): Promise<Function<EnvRelation.NotResolved, SecretRelation.Resolved>[]> {
  return queries.find<Function<EnvRelation.NotResolved, SecretRelation.Resolved>>(collection, {
    where: ids.length ? {_id: {in: ids}} : undefined,
    relations: relations(EnvRelation.NotResolved, SecretRelation.Resolved)
  });
}
