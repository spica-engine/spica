import {Validator, Schema} from "@spica-server/core-schema";
import {IRepresentativeManager} from "@spica-server/interface-representative";
import {Resource} from "@spica-server/interface-asset";
import {registrar} from "@spica-server/asset";
import {assignId, ids, idOf, stripId} from "@spica-server/data";
import uniqid from "uniqid";
import ApiKeySchema from "./schemas/apikey.json" with {type: "json"};
import {ApikeyAsset, ApiKeyRepository} from "@spica-server/interface-passport-apikey";

const _module = "apikey";

const apikeyIds = () => ids().forCollection("apikey");

export function registerAssetHandlers(
  apiKeys: ApiKeyRepository,
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
      assignId(
        apikey,
        idOf(apikey) == null ? apikeyIds().generate() : apikeyIds().parse(idOf(apikey))
      );

      apikey.key = apikey.key || uniqid();

      return apiKeys.insert(apikey);
    },

    update: (resource: Resource<ApikeyAsset>) => {
      const apikey = resource.contents.schema;
      const id = apikeyIds().parse(idOf(apikey));

      stripId(apikey);

      return apiKeys.replaceById(id, apikey);
    },

    delete: (resource: Resource<ApikeyAsset>) =>
      apiKeys.deleteById(apikeyIds().parse(idOf(resource)))
  };
  registrar.operator(_module, operator);

  const exporter = async (id: string) => {
    if (!apikeyIds().isValid(id)) {
      return Promise.reject(`${id} is not a valid object id`);
    }
    const apikey = await apiKeys.findById(apikeyIds().parse(id));

    if (!apikey) {
      return Promise.reject(`Apikey does not exist with id ${id}`);
    }
    return assetRepManager.write(_module, id, "schema", apikey, "yaml");
  };
  registrar.exporter(_module, exporter);
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
