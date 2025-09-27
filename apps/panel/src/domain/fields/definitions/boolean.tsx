import {Checkbox} from "oziko-ui-kit";
import {PrimaryAndIndexConfig, BaseFields, DefaultInputs} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {FieldKind, type FieldDefinition} from "../types";
import {
  runYupValidation,
  BOOLEAN_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";

export const BOOLEAN_DEFINITION: FieldDefinition = {
  kind: FieldKind.Boolean,
  display: {label: "Boolean", icon: "checkboxBlankOutline"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(PrimaryAndIndexConfig).map(key => [key, false])
    ),
    defaultValue: false
  }),
  validateCreationForm: form => runYupValidation(BOOLEAN_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Boolean, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultBoolean,
    configurationValues: PrimaryAndIndexConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Boolean,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => (v === true ? "✔" : v === false ? "✘" : ""),
  capabilities: {hasDefaultValue: true, primaryEligible: true, indexable: true},
  renderValue: value => (
    <Checkbox className={`${styles.checkbox} ${styles.booleanValue}`} checked={value} />
  ),
  renderInput: ({value, onChange, className}) => (
    <Checkbox
      className={`${className} ${styles.checkbox}`}
      checked={value}
      onChange={() => onChange(!value)}
    />
  )
};
