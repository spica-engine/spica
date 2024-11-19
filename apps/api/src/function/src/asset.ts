import {registrar} from "@spica/api/src/asset";
import {Resource} from "@spica/interface";
import {Schema, Validator} from "@spica/core";
import {Function, FunctionContents, FunctionWithDependencies} from "@spica/interface";
import {generate} from "./schema/enqueuer.resolver";
import * as CRUD from "./crud";
import {FunctionService} from "@spica/api/src/function/services";
import {FunctionEngine} from "./engine";
import {LogService} from "@spica/api/src/function/src/log";
import {ObjectId} from "@spica/database";
import {IRepresentativeManager} from "@spica/interface";

const _module = "function";

export function registerAssetHandlers(
  fs: FunctionService,
  engine: FunctionEngine,
  logs: LogService,
  schemaValidator: Validator,
  manager: IRepresentativeManager
) {
  const validator = async (resource: Resource<FunctionContents>) => {
    const fn = resource.contents.schema;

    const schemaValidation = () => Promise.resolve(validateSchema(fn, schemaValidator));

    const validations = [schemaValidation];

    await Promise.all(validations.map(v => v()));
  };

  registrar.validator(_module, validator);

  const operator = {
    insert: async (resource: Resource<FunctionContents>) => {
      const schema = CRUD.environment.apply(resource.contents.schema, resource.contents.env);
      const fn: any = await CRUD.insert(fs, engine, schema);

      await CRUD.index.write(fs, engine, fn._id, resource.contents.index);

      await CRUD.dependencies.install(engine, fn, resource.contents.package.dependencies);
    },

    update: async (resource: Resource<FunctionContents>) => {
      const schema = CRUD.environment.apply(resource.contents.schema, resource.contents.env);
      const fn: any = await CRUD.replace(fs, engine, schema);

      await CRUD.index.write(fs, engine, fn._id, resource.contents.index);

      fn.dependencies = resource.contents.package.dependencies;
      await CRUD.dependencies.update(engine, fn);
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
}

function validateSchema(fn: Function, validator: Validator) {
  const schema = generate({body: fn});
  const validatorMixin = Schema.validate(deleteEnqueuerValidation(schema));
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(fn);
}

function deleteEnqueuerValidation(schema: any) {
  schema.allOf = schema.allOf.map(subSchema => {
    if (!subSchema.properties || !subSchema.properties.triggers) {
      return subSchema;
    }

    Object.keys(subSchema.properties.triggers.properties).forEach(trigger => {
      subSchema.properties.triggers.properties[trigger].properties.options = true;
    });

    return subSchema;
  });
  return schema;
}
