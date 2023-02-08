import {Validator, Schema} from "@spica-server/core/schema";
import {ApiKeyService} from "@spica-server/passport/apikey/src/apikey.service";
import {ApiKey} from "@spica-server/passport/apikey/src/interface";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {Resource} from "@spica-server/interface/asset";
import {registrar} from "@spica-server/asset";
import {ObjectId} from "@spica-server/database";
import * as uniqid from "uniqid";

const _module = "apikey";

export function registerAssetHandlers(
  as: ApiKeyService,
  schemaValidator: Validator,
  assetRepManager: IRepresentativeManager
) {
  const validator = (resource: Resource<ApikeyAsset>) => {
    const apikey = resource.contents.schema;
    return validateApikey(apikey, schemaValidator);
  };
  registrar.validator(_module, validator);

  const operator = {
    insert: (resource: Resource<ApikeyAsset>) => {
      const apikey = resource.contents.schema;
      apikey._id = new ObjectId(apikey._id);

      apikey.key = apikey.key || uniqid();

      return as.insertOne(apikey);
    },

    update: (resource: Resource<ApikeyAsset>) => {
      const apikey = resource.contents.schema;
      const _id = new ObjectId(apikey._id);

      delete apikey._id;

      return as.findOneAndReplace({_id}, apikey, {
        returnOriginal: false
      });
    },

    delete: (resource: Resource<ApikeyAsset>) => as.deleteOne({_id: new ObjectId(resource._id)})
  };
  // registrar.operator(_module, operator);

  const exporter = async (_id: string) => {
    if (!ObjectId.isValid(_id)) {
      return Promise.reject(`${_id} is not a valid object id`);
    }
    const apikey = await as.findOne({_id: new ObjectId(_id)});

    if (!apikey) {
      return Promise.reject(`Apikey does not exist with _id ${_id}`);
    }
    return assetRepManager.write(_module, _id, "schema", apikey, "yaml");
  };
  registrar.exporter(_module, exporter);

  const lister = () =>
    as.find().then(apikeys => {
      return apikeys.map(d => {
        return {
          _id: d._id.toHexString(),
          title: d.name
        };
      });
    });
}

export interface ApikeyAsset {
  schema: ApiKey;
}

function validateApikey(apikey: any, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/passport/apikey");

  const pipe: any = new validatorMixin(validator);
  return pipe.transform(apikey);
}
