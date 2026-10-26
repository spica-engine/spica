import {Validator, Schema} from "@spica-server/core-schema";
// @TODO: create separate apikey services module and update this import
import {ApiKeyService} from "./apikey.service.js";
import {IRepresentativeManager} from "@spica-server/interface-representative";
import {Resource} from "@spica-server/interface-asset";
import {registrar} from "@spica-server/asset";
import {ReturnDocument} from "@spica-server/database";
import {ids} from "@spica-server/data";
import uniqid from "uniqid";
import ApiKeySchema from "./schemas/apikey.json" with {type: "json"};
import {ApikeyAsset} from "@spica-server/interface-passport-apikey";

const _module = "apikey";

const apikeyIds = () => ids().forCollection("apikey");

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
      apikey._id = apikey._id == null ? apikeyIds().generate() : apikeyIds().parse(apikey._id);

      apikey.key = apikey.key || uniqid();

      return as.insertOne(apikey);
    },

    update: (resource: Resource<ApikeyAsset>) => {
      const apikey = resource.contents.schema;
      const _id = apikeyIds().parse(apikey._id);

      delete apikey._id;

      return as.findOneAndReplace({_id}, apikey, {
        returnDocument: ReturnDocument.AFTER
      });
    },

    delete: (resource: Resource<ApikeyAsset>) =>
      as.deleteOne({_id: apikeyIds().parse(resource._id)})
  };
  registrar.operator(_module, operator);

  const exporter = async (_id: string) => {
    if (!apikeyIds().isValid(_id)) {
      return Promise.reject(`${_id} is not a valid object id`);
    }
    const apikey = await as.findOne({_id: apikeyIds().parse(_id)});

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
          _id: d._id.toString(),
          title: d.name
        };
      });
    });
}

function validateApikey(apikey: any, validator: Validator): Promise<void> {
  const schema: any = JSON.parse(JSON.stringify(ApiKeySchema));

  schema.$id = "http://spica.internal/passport/apikey-with-policies";
  schema.properties.policies = {
    type: "array",
    items: {
      type: "string"
    }
  };
  const validatorMixin = Schema.validate(schema);

  const pipe: any = new validatorMixin(validator);
  return pipe.transform(apikey);
}
