import { BasicConfig, BaseFields } from "../creation-form-schemas";
import { freezeFormDefaults, BASE_FORM_DEFAULTS } from "../defaults";
import { type FieldDefinition, FieldKind } from "../types";
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
    type: FieldKind.Object, //FieldKind.Json is not in TypeInputTypeMap yet, so we use Object for now, will be fixed later
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => {
    if (!v) return "";
    try {
      const str = typeof v === "string" ? v : JSON.stringify(v);
      return str.length > 20 ? str.slice(0, 20) + "…" : str;
    } catch {
      return "{…}";
    }
  },
  capabilities: {indexable: true},
  renderValue: value => JSON.stringify(value).slice(0, 30) + (String(value).length > 30 ? "…" : "")
};