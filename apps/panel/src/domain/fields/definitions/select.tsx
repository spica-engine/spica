import {Button, Icon, type TypeSelectRef, Select} from "oziko-ui-kit";
import {useRef, useEffect} from "react";
import {
  MinimalConfig,
  BaseFields,
  SpecializedInputs,
  ValidationInputs
} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {FieldKind, type FieldDefinition} from "../types";
import {
  runYupValidation,
  MULTISELECT_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";

export const MULTISELECT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Multiselect,
  display: {label: "Multiple Selection", icon: "formatListChecks"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      multipleSelectionType: "string",
      chip: [],
      maxItems: undefined
    },
    configurationValues: Object.fromEntries(Object.keys(MinimalConfig).map(key => [key, false]))
  }),
  validateCreationForm: form => runYupValidation(MULTISELECT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Multiselect, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: {
      ...BaseFields,
      multipleSelectionType: SpecializedInputs.multipleSelectionType,
      maxItems: ValidationInputs.maxItems,
      chip: SpecializedInputs.chip
    },
    configurationValues: MinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Multiselect,
    title: property.title,
    description: property.description,
    enum: property.enum
  }),
  getFormattedValue: value => value || [],
  capabilities: {enumerable: true, indexable: true},
  renderValue: (value, deletable) => (
    <div className={styles.multipleSelectionCell}>
      {value?.slice(0, 2)?.map?.((_: any, index: number) => (
        <Button key={index} variant="icon" className={styles.grayBox}>
          {index + 1}
        </Button>
      ))}
      {value?.length > 2 && (
        <Button variant="icon" className={styles.grayBox}>
          <Icon name="dotsHorizontal" size="xs" />
        </Button>
      )}
      <Button variant="icon" className={styles.grayBox}>
        <Icon name="plus" size="xs" />
      </Button>
      {deletable && value && (
        <Button variant="icon">
          <Icon name="close" size="sm" />
        </Button>
      )}
    </div>
  ),
  renderInput: ({value, onChange, properties, title, floatingElementRef}) => {
    const selectRef = useRef<TypeSelectRef>(null);

    useEffect(() => {
      selectRef.current?.toggleDropdown(true);
    }, [selectRef]);

    return (
      <Select
        title={title}
        selectRef={selectRef}
        externalDropdownRef={floatingElementRef}
        disableClick
        options={properties.items.enum || []}
        value={value}
        multiple={true}
        onChange={onChange}
      />
    );
  }
};
