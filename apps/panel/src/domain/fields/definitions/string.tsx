import {Button, Icon, type TypeSelectRef, Select, Input} from "oziko-ui-kit";
import {useRef, useEffect, type RefObject} from "react";
import {TranslatableConfig, BaseFields, PresetPanel, DefaultInputs} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {applyPresetLogic} from "../presets";
import {FieldKind, type FieldDefinition, type TypeProperty} from "../types";
import {
  runYupValidation,
  STRING_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";

export const STRING_DEFINITION: FieldDefinition = {
  kind: FieldKind.String,
  display: {label: "String", icon: "formatQuoteClose"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableConfig).map(key => [key, false])
    ),
    defaultValue: ""
  }),
  getDefaultValue: property => property.default,
  validateCreationForm: form => runYupValidation(STRING_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.String, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    presetValues: PresetPanel,
    defaultValue: DefaultInputs.defaultString,
    configurationValues: TranslatableConfig
  }),
  buildValueProperty: property => ({
    ...property,
    type: FieldKind.String,
    className: property?.enum ? styles.enumInput : undefined,
    description: undefined
  } as TypeProperty),
  applyPresetLogic: (form, oldValues) => applyPresetLogic(FieldKind.String, form, oldValues),
  getFormattedValue: value => typeof value === "string" ? value : "",
  capabilities: {
    enumerable: true,
    pattern: true,
    hasDefaultValue: true,
    translatable: true,
    primaryEligible: true,
    uniqueEligible: true,
    indexable: true
  },
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
  renderInput: ({value, onChange, ref, properties, title, floatingElementRef, className}) => {
    const selectRef = useRef<TypeSelectRef>(null);

    useEffect(() => {
      selectRef.current?.toggleDropdown(true);
    }, [selectRef]);

    return properties.enum ? (
      <Select
        options={properties.enum}
        value={value}
        onChange={val => onChange(val)}
        title={title}
        externalDropdownRef={floatingElementRef}
        className={className}
        selectRef={selectRef}
      />
    ) : (
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        ref={ref as RefObject<HTMLInputElement | null>}
        title={title}
        className={className}
      />
    );
  }
};
