import {registrar} from "@spica-server/asset";
import {Resource} from "@spica-server/interface/asset";
import {Schema, Validator} from "@spica-server/core/schema";
import {
  Function,
  FunctionContents,
  FunctionWithDependencies
} from "@spica-server/interface/function";
import {generate} from "./schema/enqueuer.resolver";
import * as CRUD from "./crud";
import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "./engine";
import {LogService} from "@spica-server/function/src/log";
import {ObjectId} from "@spica-server/database";
import {IRepresentativeManager} from "@spica-server/interface/representative";

const _module = "function";

export function registerAssetHandlers(
  fs: FunctionService,
  engine: FunctionEngine,
  logs: LogService,
  schemaValidator: Validator,
  manager: IRepresentativeManager
) {
  const validator = (resource: Resource<FunctionContents>) => {
    const fn = resource.contents.schema;
    return validateFn(fn, schemaValidator);
  };

  registrar.validator(_module, validator);

  const operator = {
    insert: async (resource: Resource<FunctionContents>) => {
      const schema = CRUD.environment.apply(resource.contents.schema, resource.contents.env);
      const fn: any = await CRUD.insert(fs, engine, schema);

      await CRUD.index.write(fs, engine, fn._id, resource.contents.index);

      const fnWithDeps = {dependencies: resource.contents.package.dependencies, ...fn};
      await CRUD.dependencies.reinstall(engine, fnWithDeps);
    },

    update: async (resource: Resource<FunctionContents>) => {
      const schema = CRUD.environment.apply(resource.contents.schema, resource.contents.env);
      const fn: any = await CRUD.replace(fs, engine, schema);

      await CRUD.index.write(fs, engine, fn._id, resource.contents.index);

      fn.dependencies = resource.contents.package.dependencies;
      await CRUD.dependencies.reinstall(engine, fn);
    },

    delete: async (resource: Resource<FunctionContents>) => {
      await CRUD.remove(fs, engine, logs, resource._id);
    }
  };

  registrar.operator(_module, operator);

  const exporter = async (_id: string) => {
    if (!ObjectId.isValid(_id)) {
      return Promise.reject(`${_id} is not a valid id.`);
    }

    const fn = (await fs.findOne({_id: new ObjectId(_id)})) as FunctionWithDependencies;

    if (!fn) {
      return Promise.reject(`Function does not exist with _id ${_id}`);
    }

    const promises = [];

    // env and schema
    const env = JSON.parse(JSON.stringify(fn.env || {}));
    for (const key of Object.keys(env)) {
      fn.env[key] = `{${key}}`;
    }

    promises.push(
      manager.write(_module, _id, "schema", fn, "yaml"),
      manager.write(_module, _id, "env", env, "env")
    );

    // dependencies
    const dependencies = await engine.getPackages(fn).then(deps => {
      const depsDef = deps.reduce((acc, curr) => {
        delete curr.types;
        acc[curr.name] = curr.version;
        return acc;
      }, {});
      return depsDef;
    });

    promises.push(manager.write(_module, _id, "package", {dependencies}, "json"));

    // index
    const index = await engine.read(fn);

    promises.push(
      manager.write(_module, _id, "index", index, fn.language == "javascript" ? "js" : "ts")
    );

    Promise.all(promises);
  };

  registrar.exporter(_module, exporter);

  registrar.resourceLister(_module, () =>
    fs.find().then(fns => {
      return fns.map(f => {
        return {
          _id: f._id.toHexString(),
          title: f.name
        };
      });
    })
  );
}

function validateFn(fn: Function, validator: Validator) {
  const validatorMixin = Schema.validate(generate({body: fn}));
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(fn);
}
