import {Button, Icon, type TypeSelectRef, Select} from "oziko-ui-kit";
import {useRef, useEffect} from "react";
import {
  MinimalConfig,
  BaseFields,
  SpecializedInputs,
  ValidationInputs,
  PresetPanel
} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {FieldKind, type FieldDefinition, type TypeProperty} from "../types";
import {
  runYupValidation,
  MULTISELECT_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import {buildBaseProperty} from "../registry";
import {applyPresetLogic} from "../presets";

export const MULTISELECT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Multiselect,
  display: {label: "Multiple Selection", icon: "formatListChecks"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      chip: []
    },
    configurationValues: Object.fromEntries(Object.keys(MinimalConfig).map(key => [key, false])),
    multipleSelectionTab: {
      multipleSelectionType: "",
      maxItems: undefined
    },
    type: FieldKind.Multiselect
  }),
  validateCreationForm: form => runYupValidation(MULTISELECT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Multiselect, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: MinimalConfig,
    presetValues: PresetPanel,
    multipleSelectionTab: {
      multipleSelectionType: SpecializedInputs.multipleSelectionType,
      maxItems: ValidationInputs.maxItems
    }
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Multiselect,
      description: undefined,
      id: crypto.randomUUID(),
    }) as TypeProperty,
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const fv = form.fieldValues;
    const multipleSelectionTab = form.multipleSelectionTab;
    return {
      ...base,
      items: {
        type: multipleSelectionTab?.multipleSelectionType,
        enum: Array.isArray(fv.chip) && fv.chip.length ? fv.chip : undefined
      },
      maxItems: multipleSelectionTab?.maxItems
    };
  },
  applyPresetLogic: (form, oldValues) => applyPresetLogic(FieldKind.String, form, oldValues),
  applySelectionTypeLogic: (form, properties) => {
    const newSelectionType = form.multipleSelectionTab?.multipleSelectionType;
    const updatedForm = {
      ...form,
      fieldValues: {
        ...form.fieldValues,
        chip:
          newSelectionType === "string"
            ? form.fieldValues.chip.map((v: string | number) => String(v))
            : form.fieldValues.chip
                .map((v: string | number) => Number(v))
                .filter((v: number) => !isNaN(v))
      }
    };
    const updatedFieldProperties = {
      ...properties,
      chip: {
        ...SpecializedInputs.chip,
        valueType: newSelectionType
      }
    };
    return {updatedForm, updatedFieldProperties};
  },
  getDisplayValue: value => value || [],
  getSaveReadyValue: value => value || [],
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
        className={styles.enumInput}
      />
    );
  }
};
