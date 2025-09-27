import {Button, Icon, useAdaptivePosition, Portal, ArrayInput} from "oziko-ui-kit";
import type {TypeInputRepresenterError} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";
import {useRef, useEffect, type RefObject} from "react";
import {
  TranslatableMinimalConfig,
  BaseFields,
  SpecializedInputs,
  DefaultInputs,
  ValidationInputs,
  PresetPanel
} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {applyPresetLogic} from "../presets";
import {type FieldDefinition, FieldKind} from "../types";
import {
  runYupValidation,
  ARRAY_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";

// DID NOT TESTED FOR COMPOSITE ARRAYS SUCH AS ARRAY OF OBJECTS OR ARRAY OF MULTISELECTS
export const ARRAY_DEFINITION: FieldDefinition = {
  kind: FieldKind.Array,
  display: {label: "Array", icon: "ballot"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      arrayType: "string"
    },
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    )
  }),
  getDefaultValue: property => property.default,
  validateCreationForm: form => runYupValidation(ARRAY_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Array, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: {
      ...BaseFields,
      arrayType: SpecializedInputs.arrayType,
      arrayItemTitle: SpecializedInputs.arrayItemTitle,
      arrayItemDescription: SpecializedInputs.arrayItemDescription,
      defaultString: {
        ...DefaultInputs.defaultString,
        renderCondition: {field: "arrayType", equals: "string"}
      },
      defaultBoolean: {
        ...DefaultInputs.defaultBoolean,
        renderCondition: {field: "arrayType", equals: "boolean"}
      },
      defaultNumber: {
        ...DefaultInputs.defaultNumber,
        renderCondition: {field: "arrayType", equals: "number"}
      },
      minNumber: {
        ...ValidationInputs.minNumber,
        renderCondition: {field: "arrayType", equals: "number"}
      },
      maxNumber: {
        ...ValidationInputs.maxNumber,
        renderCondition: {field: "arrayType", equals: "number"}
      },
      makeEnumerated: {
        ...SpecializedInputs.makeEnumerated,
        renderCondition: {field: "arrayType", equals: ["number", "string"]}
      },
      enumeratedValues: {
        ...SpecializedInputs.enumeratedValues,
        valueType: "number",
        renderCondition: {field: "makeEnumerated", equals: true}
      },
      regularExpression: {
        ...ValidationInputs.regularExpression,
        renderCondition: {field: "definePattern", equals: true}
      },
      uniqueItems: {
        ...SpecializedInputs.uniqueItems,
        renderCondition: {
          field: "arrayType",
          notEquals: ["multiselect", "location", "object", "boolean"]
        }
      },
      multipleSelectionType: {
        ...SpecializedInputs.multipleSelectionType,
        renderCondition: {field: "arrayType", equals: "multiselect"}
      },
      minItems: {
        ...ValidationInputs.minItems,
        renderCondition: {field: "arrayType", notEquals: ["multiselect", "location", "object"]}
      },
      maxItems: {
        ...ValidationInputs.maxItems,
        renderCondition: {field: "arrayType", notEquals: ["location", "object"]}
      },
      chip: {
        ...SpecializedInputs.chip,
        renderCondition: {field: "arrayType", equals: "multiselect"}
      }
    },
    // Array reads enum/pattern for number items from presets
    presetValues: {
      definePattern: PresetPanel.definePattern,
      regularExpression: PresetPanel.regularExpression,
      enumeratedValues: PresetPanel.enumeratedValues
    },
    configurationValues: TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Array,
    title: property.title,
    description: property.description,
    items: property.items
  }),
  requiresInnerFields: form => form.fieldValues?.arrayType === "object",
  applyPresetLogic: (form, oldValues) =>
    form.fieldValues.arrayType === "string"
      ? applyPresetLogic(FieldKind.String, form, oldValues)
      : form,
  getFormattedValue: v => (Array.isArray(v) ? `${v.length} item${v.length === 1 ? "" : "s"}` : ""),
  capabilities: {supportsInnerFields: true},
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
  renderInput: ({value, onChange, ref, properties, title, floatingElementRef}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const {targetPosition, calculatePosition} = useAdaptivePosition({
      containerRef: containerRef,
      targetRef: ref,
      initialPlacement: "bottom"
    });

    useEffect(calculatePosition, [calculatePosition]);

    const RenderedValue = ({value}: any) => ARRAY_DEFINITION.renderValue(value, false);

    const onChange_ = (val: any) => {
      console.log("Array changed:", val);
      onChange?.(val);
    };
    return (
      <div ref={containerRef}>
        <RenderedValue value={value} />
        <Portal>
          <ArrayInput
            ref={ref as RefObject<HTMLInputElement | null>}
            title={title}
            description={"description"}
            value={value}
            onChange={onChange_}
            minItems={properties.minItems}
            maxItems={properties.maxItems}
            items={properties.items}
            propertyKey={properties.key}
            errors={properties.errors as TypeInputRepresenterError}
            style={{...targetPosition, position: "absolute"}}
            className={styles.arrayInput}
          />
        </Portal>
      </div>
    );
  }
};
