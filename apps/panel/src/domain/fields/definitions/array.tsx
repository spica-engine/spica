import {Button, Icon, useAdaptivePosition, ArrayInput, Popover} from "oziko-ui-kit";
import type {TypeInputRepresenterError} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {useRef, useEffect, type RefObject} from "react";
import {
  TranslatableMinimalConfig,
  BaseFields,
  SpecializedInputs,
  DefaultInputs,
  ValidationInputs,
  PresetPanel,
  MinimalConfig
} from "../creation-form-schemas";
import {freezeFormDefaults, BASE_FORM_DEFAULTS} from "../defaults";
import {applyPresetLogic} from "../presets";
import {type FieldDefinition, FieldKind, type TypeProperty} from "../types";
import {
  runYupValidation,
  ARRAY_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "../validation";
import styles from "../field-styles.module.scss";
import {buildBaseProperty, FIELD_REGISTRY} from "../registry";
import type {Property} from "src/services/bucketService";
import {OBJECT_DEFINITION} from "./object";
import {RELATION_DEFINITION} from "./relation";

function formatArrayFieldValues(
  value: any,
  property: any,
  method: "getDisplayValue" | "getSaveReadyValue"
): Record<string, any> {
  if (!Array.isArray(value)) return [];
  const type = property?.items?.type || "string";
  const field = FIELD_REGISTRY[type as FieldKind];
  return value.map(item => field?.[method]?.(item, property?.items) || item);
}

export const ARRAY_DEFINITION: FieldDefinition = {
  kind: FieldKind.Array,
  display: {label: "Array", icon: "ballot"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      arrayItemTitle: "",
      arrayItemDescription: "",
      arrayType: "",
      chip: [],
      enumeratedValues: [],
      makeEnumerated: false,
      definePattern: false,
      regularExpression: "",
      uniqueItems: false,
      defaultString: "",
      multipleSelectionType: ""
    },
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    ),
    type: FieldKind.Array
  }),
  getDefaultValue: property => property.default,
  getDisplayValue: (value, property) => formatArrayFieldValues(value, property, "getDisplayValue"),
  getSaveReadyValue: (value, property) =>
    formatArrayFieldValues(value, property, "getSaveReadyValue"),
  validateCreationForm: form => runYupValidation(ARRAY_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Array, properties, required),
  buildCreationFormProperties: isInnerField => ({
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
      definePattern: {
        ...ValidationInputs.definePattern,
        renderCondition: {field: "arrayType", equals: "string"}
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
    presetValues: {
      definePattern: PresetPanel.definePattern,
      regularExpression: PresetPanel.regularExpression,
      enumeratedValues: PresetPanel.enumeratedValues
    },
    configurationValues: isInnerField ? MinimalConfig : TranslatableMinimalConfig
  }),
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const fv = form.fieldValues;
    const pv = form.presetValues || {};

    const item: Property = {
      type: fv.arrayType,
      title: fv.arrayItemTitle,
      description: fv.arrayItemDescription?.length ? fv.arrayItemDescription : undefined,
      default: form.defaultValue
    };

    if (pv.enumeratedValues?.length) item.enum = pv.enumeratedValues;
    if (pv.regularExpression?.length) item.pattern = pv.regularExpression;
    if (fv.maxNumber != null) item.maximum = fv.maxNumber;
    if (fv.minNumber != null) item.minimum = fv.minNumber;

    if (fv.arrayType === "multiselect") {
      item.items = {
        type: fv.multipleSelectionType,
        enum: Array.isArray(fv.chip) && fv.chip.length ? fv.chip : undefined
      };
      item.maxItems = fv.maxItems;
    }

    if (fv.arrayType === "object" && Array.isArray(form.innerFields)) {
      item.properties = form.innerFields.reduce<Record<string, Property>>((acc, inner) => {
        const innerDef = FIELD_REGISTRY[inner.type as FieldKind];
        if (innerDef?.buildCreationFormApiProperty) {
          acc[inner.fieldValues.title] = innerDef.buildCreationFormApiProperty(inner);
        } else {
          throw new Error(`Cannot build property for field type ${inner?.type}`);
        }
        return acc;
      }, {});
    }

    return {
      ...base,
      maxItems: fv.arrayType === "multiselect" ? undefined : (fv.maxItems ?? undefined),
      minItems: fv.minItems ?? undefined,
      uniqueItems: fv.uniqueItems ?? undefined,
      items: item
    };
  },
  buildValueProperty: (property, relationHandlers) => {
    return {
      ...property,
      type: FieldKind.Array,
      description: undefined,
      items:
        property.items.type === "object"
          ? {
              ...property.items,
              ...OBJECT_DEFINITION.buildValueProperty(property.items, relationHandlers)
            }
          : property.items.type === "relation"
            ? {
                ...property.items,
                ...RELATION_DEFINITION.buildValueProperty(property.items, relationHandlers)
              }
            : property.items,
      id: crypto.randomUUID()
    } as TypeProperty;
  },
  requiresInnerFields: form => form.fieldValues?.arrayType === "object",
  applyPresetLogic: (form, oldValues) =>
    form.fieldValues.arrayType === "string"
      ? applyPresetLogic(FieldKind.String, form, oldValues)
      : form,
  capabilities: {supportsInnerFields: true},
  renderValue: (value, deletable) => {
    const formattedValue = Array.isArray(value) ? value : [];
    return (
      <div className={styles.multipleSelectionCell}>
        {formattedValue?.slice(0, 2)?.map?.((_: any, index: number) => (
          <Button key={index} variant="icon" className={styles.grayBox}>
            {index + 1}
          </Button>
        ))}
        {formattedValue?.length > 2 && (
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
    );
  },
  renderInput: ({value, onChange, ref, properties, title, onClose}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const {targetPosition, calculatePosition} = useAdaptivePosition({
      containerRef: containerRef,
      targetRef: ref,
      initialPlacement: "bottom"
    });

    useEffect(() => {
      if (ref.current && ref.current.offsetHeight > 0 && ref.current.offsetWidth > 0) {
        calculatePosition();
      }
    }, [calculatePosition, ref, ref.current?.offsetHeight, ref.current?.offsetWidth]);

    const RenderedValue = ({value}: {value: any[]}) => ARRAY_DEFINITION.renderValue(value, false);

    return (
      <div ref={containerRef}>
        <RenderedValue value={value} />
        <Popover
          contentProps={{
            ref: ref as RefObject<HTMLDivElement | null>,
            style: targetPosition ?? {opacity: 0}
          }}
          open
          onClose={onClose}
          content={
            <ArrayInput
              title={title}
              description={"description"}
              value={value}
              onChange={onChange}
              minItems={properties.minItems}
              maxItems={properties.maxItems}
              items={properties.items}
              propertyKey={properties.key ?? properties.items.title ?? "Item"}
              errors={properties.errors as TypeInputRepresenterError}
              className={styles.arrayInput}
            />
          }
        />
      </div>
    );
  }
};
