import {Checkbox} from "oziko-ui-kit";
import {
  PrimaryAndIndexConfig,
  BaseFields,
  DefaultInputs,
  MinimalInnerFieldConfig
} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {FieldKind, type FieldDefinition, type TypeProperty} from "../types";
import {
  runYupValidation,
  BOOLEAN_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import {buildBaseProperty} from "../registry";

export const BOOLEAN_DEFINITION: FieldDefinition = {
  kind: FieldKind.Boolean,
  display: {label: "Boolean", icon: "checkboxBlankOutline"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(PrimaryAndIndexConfig).map(key => [key, false])
    ),
    defaultValue: false,
    type: FieldKind.Boolean
  }),
  getDisplayValue: value => value,
  getSaveReadyValue: value => value,
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const def = form.defaultValue;
    return {
      ...base,
      default: def
    };
  },
  validateCreationForm: form => runYupValidation(BOOLEAN_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Boolean, properties, required),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultBoolean,
    configurationValues: isInnerField ? MinimalInnerFieldConfig : PrimaryAndIndexConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Boolean,
      description: undefined,
      id: crypto.randomUUID(),
    }) as TypeProperty,
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
