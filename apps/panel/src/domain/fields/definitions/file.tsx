import {Icon, StorageInput} from "oziko-ui-kit";
import {TranslatableMinimalConfig, BaseFields} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {type FieldDefinition, FieldKind} from "../types";
import {runYupValidation, FILE_FIELD_CREATION_FORM_SCHEMA, validateFieldValue} from "../validation";
import styles from "../field-styles.module.scss";

export const FILE_DEFINITION: FieldDefinition = {
  kind: FieldKind.File,
  display: {label: "File", icon: "imageMultiple"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    )
  }),
  validateCreationForm: form => runYupValidation(FILE_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.File, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.File,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: value => value || null,
  capabilities: {},
  renderValue: value => (
    <div className={styles.fileCell}>
      <Icon name="imageMultiple" size="xs" />
      {value ? <span>{value}</span> : <span className={styles.grayText}>Click or Drag&Drop</span>}
    </div>
  ),
  renderInput: ({title}) => {
    return <StorageInput onUpload={() => {}} label={title} />;
  }
};
