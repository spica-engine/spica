import {Color} from "oziko-ui-kit";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {type FieldDefinition, FieldKind, type TypeProperty} from "../types";
import {
  runYupValidation,
  COLOR_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import {BaseFields, MinimalConfig} from "../creation-form-schemas";
import {buildBaseProperty} from "../registry";

export const COLOR_DEFINITION: FieldDefinition = {
  kind: FieldKind.Color,
  display: {label: "Color", icon: "palette"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(Object.keys(MinimalConfig).map(key => [key, false])),
    type: FieldKind.Color
  }),
  validateCreationForm: form => runYupValidation(COLOR_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Color, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: MinimalConfig
  }),
  buildCreationFormApiProperty: buildBaseProperty,
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Color,
      description: undefined
    }) as TypeProperty,
  getDefaultValue: property => property.default || "#000000",
  getDisplayValue: value => value ?? "#000000",
  getSaveReadyValue: value => value ?? "#000000",
  capabilities: {hasDefaultValue: true, indexable: true},
  renderValue: value => value,
  renderInput: ({value, onChange, className}) => {
    return <Color value={value} onChange={onChange} className={className} />;
  }
};
