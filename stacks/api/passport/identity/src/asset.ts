import {registrar, Resource} from "@spica-server/asset";
import {Schema, Validator} from "@spica-server/core/schema";
import {PreferenceService} from "@spica-server/preference/services";

const _module = "identity-settings";

interface IdentitySettingsContents {
  schema: IdentitySchema;
}

interface IdentitySchema {
  attributes: {
    [key: string]: any;
  };
}

export function registerAssetHandlers(prefService: PreferenceService, schemaValidator: Validator) {
  const validator = (resource: Resource<IdentitySettingsContents>) => {
    const schema = resource.contents.schema;
    return validateFn(schema, schemaValidator);
  };

  registrar.validator(_module, validator);

  const upsert = (resource: Resource<IdentitySettingsContents>) => {
    return prefService.updateOne(
      {scope: "passport"},
      {$set: {identity: resource.contents.schema}},
      {upsert: true}
    );
  };

  const remove = _ => {
    return prefService.updateOne({scope: "passport"}, {$set: {identity: {attributes: {}}}});
  };

  const operator = {
    insert: upsert,
    update: upsert,
    delete: remove
  };

  registrar.operator(_module, operator);
}

function validateFn(schema: IdentitySchema, validator: Validator) {
  const validatorMixin = Schema.validate("http://spica.internal/passport/identity-attributes");
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(schema);
}
