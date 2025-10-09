import {Icon, type TypeFile} from "oziko-ui-kit";
import {TranslatableMinimalConfig, BaseFields, MinimalConfig} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {type FieldDefinition, FieldKind, type TypeProperty} from "../types";
import {runYupValidation, FILE_FIELD_CREATION_FORM_SCHEMA, validateFieldValue} from "../validation";
import styles from "../field-styles.module.scss";
import {buildBaseProperty} from "../registry";
import StorageFileSelect from "../../../components/organisms/storage-file-select/StorageFileSelect";
import { useState } from "react";

export const FILE_DEFINITION: FieldDefinition = {
  kind: FieldKind.File,
  display: {label: "File", icon: "imageMultiple"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    ),
    type: FieldKind.File
  }),
  validateCreationForm: form => runYupValidation(FILE_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.File, properties, required),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableMinimalConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.File,
      description: undefined,
      id: crypto.randomUUID(),
    }) as TypeProperty,
  buildCreationFormApiProperty: buildBaseProperty,
  getDisplayValue: value => value || null,
  getSaveReadyValue: value => value || null,
  capabilities: {},
  renderValue: value => (
    <div className={styles.fileCell}>
      <Icon name="imageMultiple" size="xs" />
      {value ? <span>{value}</span> : <span className={styles.grayText}>Click or Drag&Drop</span>}
    </div>
  ),
  renderInput: ({value, onChange, ref}) => {
    const [isFileSelectModalOpen, setIsFileSelectModalOpen] = useState(true);
    const RenderedValue = ({value}: {value: Object}) => FILE_DEFINITION.renderValue(value, false);

    const handleSelect = (file: TypeFile) => {
      onChange(file.url);
      setIsFileSelectModalOpen(false);
    }

    return (
      <div className={styles.fileInputContainer}>
        <RenderedValue value={value} />
        <StorageFileSelect isOpen={isFileSelectModalOpen} onSelect={handleSelect} ref={ref as React.RefObject<HTMLDivElement>} />
      </div>
    );
  }
};
