import {Button, Icon, TextAreaMinimizedInput} from "oziko-ui-kit";
import {TranslatableConfig, BaseFields, MinimalConfig} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {FieldKind, type FieldDefinition} from "../types";
import {
  runYupValidation,
  TEXTAREA_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import {buildBaseProperty} from "../registry";

export const TEXTAREA_DEFINITION: FieldDefinition = {
  kind: FieldKind.Textarea,
  display: {label: "Textarea", icon: "formatColorText"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableConfig).map(key => [key, false])
    ),
    type: FieldKind.Textarea
  }),
  validateCreationForm: form => runYupValidation(TEXTAREA_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Textarea, properties, required),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Textarea,
    title: property.title,
    description: property.description,
    id: crypto.randomUUID()
  }),
  buildCreationFormApiProperty: buildBaseProperty,
  getDisplayValue: value => value || "",
  getSaveReadyValue: value => value || "",
  capabilities: {translatable: true, indexable: true},
  renderValue: (value, deletable) => {
    return (
      <div className={styles.defaultCell}>
        <div className={styles.defaultCellData}>{value}</div>
        {deletable && value && (
          <Button variant="icon">
            <Icon name="close" size="sm" />
          </Button>
        )}
      </div>
    );
  },
  renderInput: ({value, onChange, ref, title, className}) => (
    <TextAreaMinimizedInput
      value={value}
      onChange={onChange}
      title={title}
      ref={ref as React.RefObject<HTMLDivElement | null>}
      className={`${className} ${styles.textAreaInput}`}
      rows={3}
      cols={15}
      suffix={undefined}
    />
  )
};
