import {registrar} from "@spica-server/asset";
import {Resource} from "@spica-server/interface/asset";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {Schema, Validator} from "@spica-server/core/schema";
import {EnvVarsService} from "@spica-server/env_var/services";
import {EnvVar} from "@spica-server/interface/env_var";
import {ObjectId, ReturnDocument} from "@spica-server/database";
import * as CRUD from "./crud";

const _module = "env_var";

export function registerAssetHandlers(
  evs: EnvVarsService,
  schemaValidator: Validator,
  manager: IRepresentativeManager
) {
  const validator = async (resource: Resource<EnvVarAsset>) => {
    const envVar = resource.contents.schema;
    await validateEnvVar(envVar, schemaValidator);
  };

  registrar.validator(_module, validator);

  const operator = {
    insert: (resource: Resource<EnvVarAsset>) => CRUD.insert(evs, resource.contents.schema),

    update: (resource: Resource<EnvVarAsset>) => CRUD.replace(evs, resource.contents.schema),

    delete: (resource: Resource<EnvVarAsset>) => CRUD.remove(evs, resource._id)
  };

  registrar.operator(_module, operator);

  const exporter = async (_id: string) => {
    if (!ObjectId.isValid(_id)) {
      return Promise.reject(`${_id} is not a valid object id`);
    }
    const envVar = await evs.findOne({_id: new ObjectId(_id)});

    if (!envVar) {
      return Promise.reject(`Environment variable does not exist with _id ${_id}`);
    }
    return manager.write(_module, _id, "schema", envVar, "yaml");
  };

  registrar.exporter(_module, exporter);
}

function validateEnvVar(envVar: any, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/env_var");

  const pipe: any = new validatorMixin(validator);
  return pipe.transform(envVar);
}

interface EnvVarAsset {
  schema: EnvVar;
}
