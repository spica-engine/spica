import {ObjectId} from "@spica-server/database";
import {FunctionService} from "@spica-server/function/services";
import {
  DocumentProvider,
  RepresentativeManager,
  RepresentativeProvider,
  SyncProvider
} from "@spica-server/machinery";
import {FunctionEngine} from "../engine";

export function dependecySyncProviders(
  service: FunctionService,
  manager: RepresentativeManager,
  engine: FunctionEngine
): SyncProvider {
  const module = "function";

  const getAll = async () => {
    const fns = await service.find();
    const promises = [];

    const dependencies = [];
    for (const fn of fns) {
      const promise = engine.getPackages(fn).then(deps => {
        const depsDef = deps.reduce((acc, curr) => {
          acc[curr.name] = curr.version;
          return acc;
        }, {});
        deps = deps.map(d => {
          delete d.types;
          return d;
        });
        dependencies.push({_id: fn._id.toString(), dependencies: depsDef});
      });

      promises.push(promise);
    }

    return Promise.all(promises).then(() => dependencies);
  };

  const reinstall = async fn => {
    await service.findOne({_id: new ObjectId(fn._id)});

    const oldDeps = await engine.getPackages(fn);

    await Promise.all(oldDeps.map(dep => engine.removePackage(fn, dep.name)));

    const newDepNames = fn.dependencies.map(d => d.name);
    await engine.addPackage(fn, newDepNames);

    return fn;
  };

  const uninstall = async fn => {
    const deps = await engine.getPackages(fn);
    await Promise.all(deps.map(dep => engine.removePackage(fn, dep.name)));
  };

  const document = {
    module,
    getAll,
    insert: reinstall,
    update: reinstall,
    delete: uninstall
  };

  const readAll = async () => {
    const resourceNameValidator = str => ObjectId.isValid(str);
    const files = await manager.readAll(module, resourceNameValidator, ["package.json"]);
    return files.map(file => {
      return {_id: file._id, dependencies: file.contents.package.dependencies};
    });
  };

  const write = fn => {
    return manager.write(
      module,
      fn._id.toString(),
      "package",
      {dependencies: fn.dependencies},
      "json"
    );
  };

  const rm = () => Promise.resolve();

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
