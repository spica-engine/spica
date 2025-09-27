import {Button, Icon, TextAreaInput} from "oziko-ui-kit";
import type {RefObject} from "react";
import {TranslatableConfig, BaseFields} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {FieldKind, type FieldDefinition} from "../types";
import {
  runYupValidation,
  TEXTAREA_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";

export const TEXTAREA_DEFINITION: FieldDefinition = {
  kind: FieldKind.Textarea,
  display: {label: "Textarea", icon: "formatColorText"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableConfig).map(key => [key, false])
    )
  }),
  validateCreationForm: form => runYupValidation(TEXTAREA_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Textarea, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: TranslatableConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Textarea,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => (v == null ? "" : String(v)),
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
  renderInput: ({value, onChange, ref, title, className}) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
      }
    };
    return (
      <TextAreaInput
        value={value}
        onChange={e => onChange(e.target.value)}
        title={title}
        textAreaProps={{
          ref: ref as RefObject<HTMLTextAreaElement>,
          className,
          onKeyDown: handleKeyDown
        }}
        titleRootProps={{className: styles.textAreaTitle}}
      />
    );
  }
};
