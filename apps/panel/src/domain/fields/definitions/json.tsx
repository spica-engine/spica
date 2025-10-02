import { BasicConfig, BaseFields } from "../creation-form-schemas";
import { freezeFormDefaults, BASE_FORM_DEFAULTS } from "../defaults";
import { type FieldDefinition, FieldKind, type TypeProperty } from "../types";
import { runYupValidation, JSON_FIELD_CREATION_FORM_SCHEMA, validateFieldValue } from "../validation";

export const JSON_DEFINITION: FieldDefinition = {
  kind: FieldKind.Json,
  display: {label: "JSON", icon: "dataObject"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(Object.keys(BasicConfig).map(key => [key, false]))
  }),
  validateCreationForm: form => runYupValidation(JSON_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Json, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: BasicConfig
  }),
  buildValueProperty: property => ({
    ...property,
    type: FieldKind.Object, //FieldKind.Json is not in TypeInputTypeMap yet, so we use Object for now, will be fixed later
  } as TypeProperty),
  getDisplayValue: value => JSON.parse(value),
  getSaveReadyValue: value => JSON.stringify(value),
  capabilities: {indexable: true},
  renderValue: value => JSON.stringify(value).slice(0, 30) + (String(value).length > 30 ? "…" : "")
};