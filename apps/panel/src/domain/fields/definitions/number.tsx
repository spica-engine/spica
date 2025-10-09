import {Button, Icon, type TypeSelectRef, Select, Input} from "oziko-ui-kit";
import {useRef, useEffect, type ChangeEvent, type RefObject} from "react";
import {
  BasicConfig,
  BaseFields,
  ValidationInputs,
  SpecializedInputs,
  DefaultInputs
} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {FieldKind, type FieldDefinition, type TypeProperty} from "../types";
import {
  runYupValidation,
  NUMBER_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import {buildBaseProperty} from "../registry";

export const NUMBER_DEFINITION: FieldDefinition = {
  kind: FieldKind.Number,
  display: {label: "Number", icon: "numericBox"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(Object.keys(BasicConfig).map(key => [key, false])),
    defaultValue: undefined,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      makeEnumerated: false,
      enumeratedValues: [],
      minimum: undefined,
      maximum: undefined
    },
    type: FieldKind.Number
  }),
  validateCreationForm: form => runYupValidation(NUMBER_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Number, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: {
      ...BaseFields,
      minimum: ValidationInputs.minNumber,
      maximum: ValidationInputs.maxNumber,
      makeEnumerated: SpecializedInputs.makeEnumerated,
      enumeratedValues: {
        ...SpecializedInputs.enumeratedValues,
        valueType: "number",
        renderCondition: {field: "makeEnumerated", equals: true}
      }
    },
    defaultValue: DefaultInputs.defaultNumber,
    configurationValues: BasicConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Number,
      className: property?.enum ? styles.enumInput : undefined,
      description: undefined,
      id: crypto.randomUUID(),
    }) as TypeProperty,
  getDefaultValue: property => property.default,
  getDisplayValue: value => value ?? undefined,
  getSaveReadyValue: value => value ?? undefined,
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const fv = form.fieldValues;
    return {
      ...base,
      default: form.defaultValue,
      minimum: fv.minimum,
      maximum: fv.maximum,
      enum:
        Array.isArray(fv.enumeratedValues) && fv.enumeratedValues.length
          ? fv.enumeratedValues
          : undefined
    };
  },
  capabilities: {
    enumerable: true,
    numericConstraints: true,
    pattern: true,
    hasDefaultValue: true,
    primaryEligible: true,
    uniqueEligible: true,
    indexable: true
  },
  renderValue: (value, deletable) => {
    const formattedValue = NUMBER_DEFINITION.getDisplayValue(value);
    return (
      <div className={styles.defaultCell}>
        <div className={styles.defaultCellData}>{formattedValue}</div>
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

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const isEmptyString = value === "";
      onChange?.(isEmptyString ? undefined : Number(value));
    };

    return properties.enum ? (
      <Select
        options={properties.enum}
        value={value}
        onChange={val => onChange(val)}
        title={title}
        externalDropdownRef={floatingElementRef}
        className={`${className} ${styles.enumInput}`}
        selectRef={selectRef}
        root={{className: styles.enumDisplay}}
      />
    ) : (
      <Input
        value={value}
        onChange={handleChange}
        ref={ref as RefObject<HTMLInputElement | null>}
        title={title}
        className={className}
        type="number"
      />
    );
  }
};
