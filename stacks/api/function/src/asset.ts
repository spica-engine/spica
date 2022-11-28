import {registrar, Resource} from "@spica-server/asset";
import {Schema, Validator} from "@spica-server/core/schema";
import {
  Dependency,
  Function,
  FunctionContents,
  FunctionRepresentative
} from "@spica-server/interface/function";
import {generate} from "./schema/enqueuer.resolver";
import * as CRUD from "./crud";
import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "./engine";
import {LogService} from "@spica-server/function/src/log";

const _module = "function";

export function registerAssetHandlers(
  fs: FunctionService,
  engine: FunctionEngine,
  logs: LogService,
  schemaValidator: Validator
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
}

function validateFn(fn: Function, validator: Validator) {
  const validatorMixin = Schema.validate(generate({body: fn}));
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(fn);
}
