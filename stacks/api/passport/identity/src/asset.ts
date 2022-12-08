import {registrar} from "@spica-server/asset";
import {Resource} from "@spica-server/interface/asset"
import {Schema, Validator} from "@spica-server/core/schema";
import {PreferenceService} from "@spica-server/preference/services";

/**
 * Preference has 2 sub modules named bucket(not yet) and identity
 * So we should also check the _id of the resource since it explains that preference for identity or bucket
 * It's a bit different than the other modules
 */
const _module = "preference";

interface IdentitySettingsContents {
  schema: IdentitySchema;
}

interface IdentitySchema {
  attributes: {
    [key: string]: any;
  };
}

function isIdentityPreference(r: Resource<IdentitySettingsContents>) {
  return r._id == "identity";
}

export function registerAssetHandlers(prefService: PreferenceService, schemaValidator: Validator) {
  const validator = (resource: Resource<IdentitySettingsContents>) => {
    const schema = resource.contents.schema;

    if (!isIdentityPreference(resource)) {
      return schema;
    }

    return validateFn(schema, schemaValidator);
  };

  registrar.validator(_module, validator);

  const upsert = (resource: Resource<IdentitySettingsContents>) => {
    if (!isIdentityPreference(resource)) {
      return;
    }

    return prefService.updateOne(
      {scope: "passport"},
      {$set: {identity: resource.contents.schema}},
      {upsert: true}
    );
  };

  const remove = resource => {
    if (!isIdentityPreference(resource)) {
      return;
    }
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
