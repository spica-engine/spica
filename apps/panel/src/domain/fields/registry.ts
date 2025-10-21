/**
 * Field Registry
 * ------------------------------------------------------------
 * Central access to field definitions. Each definition encapsulates
 * defaults, property construction, parsing, formatting and validation.
 */

import type {BucketType, Property} from "src/services/bucketService";
import {BASE_FORM_DEFAULTS, DEFAULT_COORDINATES, freezeFormDefaults} from "./defaults";
import {applyPresetLogic} from "./presets";
import {
  type FieldDefinition,
  type ObjectInputRelationHandlers,
  type TypeProperty,
  type FieldCreationFormProperties,
  type FieldFormState,
  FieldKind,
  type RelationInputRelationHandlers
} from "./types";
import {
  runYupValidation,
  STRING_FIELD_CREATION_FORM_SCHEMA,
  NUMBER_FIELD_CREATION_FORM_SCHEMA,
  BOOLEAN_FIELD_CREATION_FORM_SCHEMA,
  DATE_FIELD_CREATION_FORM_SCHEMA,
  TEXTAREA_FIELD_CREATION_FORM_SCHEMA,
  MULTISELECT_FIELD_CREATION_FORM_SCHEMA,
  RELATION_FIELD_CREATION_FORM_SCHEMA,
  LOCATION_FIELD_CREATION_FORM_SCHEMA,
  ARRAY_FIELD_CREATION_FORM_SCHEMA,
  OBJECT_FIELD_CREATION_FORM_SCHEMA,
  FILE_FIELD_CREATION_FORM_SCHEMA,
  RICHTEXT_FIELD_CREATION_FORM_SCHEMA,
  JSON_FIELD_CREATION_FORM_SCHEMA,
  COLOR_FIELD_CREATION_FORM_SCHEMA,
  validateFieldValue
} from "./validation";
import type {
  TypeInputTypeMap,
  TypeProperties
} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";

import {
  BaseFields,
  BasicConfig,
  DefaultInputs,
  MinimalConfig,
  MinimalInnerFieldConfig,
  OnlyRequiredConfig,
  PresetPanel,
  PrimaryAndIndexConfig,
  RelationFieldConfig,
  SpecializedInputs,
  TranslatableConfig,
  TranslatableMinimalConfig,
  ValidationInputs
} from "./creation-form-schemas";
import type {
  RelationState,
  TypeGetMoreOptionsMap,
  TypeGetOptionsMap,
  TypeSearchOptionsMap
} from "src/hooks/useRelationInputHandlers";
import styles from "./field-styles.module.scss";
export function isFieldKind(value: string): value is FieldKind {
  return (Object.values(FieldKind) as string[]).includes(value);
}

function buildBaseProperty(values: FieldFormState): Property {
  const {fieldValues, configurationValues, type, innerFields} = values;
  return {
    type,
    title: fieldValues.title,
    description: fieldValues.description || undefined,
    options: {
      position: "bottom",
      index: configurationValues.index || undefined,
      unique: configurationValues.uniqueValues || undefined,
      translate: configurationValues.translate || undefined
    },
    required:
      innerFields && innerFields.length > 0
        ? innerFields
            .filter(i => i.configurationValues.requiredField)
            ?.map?.(i => i.fieldValues.title)
        : undefined
  } as Property;
}

function isValidDate(dateObject: Date) {
  return dateObject instanceof Date && !isNaN(dateObject.getTime());
}

type TypeLocation =
  | {lat: number; lng: number}
  | {
      type: "Point";
      coordinates: [number, number];
    };

function getLocationType(value: any): "geojson" | "latlng" | "unknown" | "none" {
  if (value === null || value === undefined) return "none";
  if (
    value?.type === "Point" &&
    Array.isArray(value?.coordinates) &&
    value.coordinates.length === 2
  ) {
    return "geojson";
  }
  if (typeof value?.lat === "number" && typeof value?.lng === "number") {
    return "latlng";
  }
  return "unknown";
}

const STRING_DEFINITION: FieldDefinition = {
  kind: FieldKind.String,
  display: {label: "String", icon: "formatQuoteClose"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableConfig).map(key => [key, false])
    ),
    defaultValue: "",
    type: FieldKind.String
  }),
  getDefaultValue: property => property.default || "",
  getDisplayValue: value => (typeof value === "string" ? value : ""),
  getSaveReadyValue: value => (typeof value === "string" ? value : ""),
  validateCreationForm: form => runYupValidation(STRING_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.String, properties),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultString,
    configurationValues: isInnerField ? MinimalConfig : TranslatableConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.String,
      id: crypto.randomUUID(),
      description: undefined
    }) as TypeProperty,
  applyPresetLogic: (form, oldValues) => applyPresetLogic(FieldKind.String, form, oldValues),
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const defaultValue = form.defaultValue?.default || form.defaultValue || "";
    return {
      ...base,
      default: typeof defaultValue === "string" && defaultValue.length ? defaultValue : undefined
    };
  },
  capabilities: {
    enumerable: true,
    pattern: true,
    hasDefaultValue: true,
    translatable: true,
    primaryEligible: true,
    uniqueEligible: true,
    indexable: true
  }
};

const NUMBER_DEFINITION: FieldDefinition = {
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
  getDefaultValue: property => (property.enum ? property.default || "" : (property.default ?? "")),
  getDisplayValue: value => value ?? undefined,
  getSaveReadyValue: value => (typeof value === "number" ? value : undefined),
  validateCreationForm: form => runYupValidation(NUMBER_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Number, properties, required),
  buildCreationFormProperties: isInnerField => ({
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
    configurationValues: isInnerField ? MinimalConfig : BasicConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Number as keyof TypeInputTypeMap,
      id: crypto.randomUUID(),
      description: undefined
    }) as TypeProperty,
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
  }
};

const BOOLEAN_DEFINITION: FieldDefinition = {
  kind: FieldKind.Boolean,
  display: {label: "Boolean", icon: "checkboxBlankOutline"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(PrimaryAndIndexConfig).map(key => [key, false])
    ),
    defaultValue: false,
    type: FieldKind.Boolean
  }),
  getDefaultValue: property => property.default || false,
  getDisplayValue: value => value,
  getSaveReadyValue: value => value,
  validateCreationForm: form => runYupValidation(BOOLEAN_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Boolean, properties, required),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultBoolean,
    configurationValues: isInnerField ? MinimalInnerFieldConfig : PrimaryAndIndexConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Boolean as keyof TypeInputTypeMap,
      id: crypto.randomUUID(),
      description: undefined
    }) as TypeProperty,
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const def = form.defaultValue;
    return {
      ...base,
      default: def
    };
  },
  capabilities: {hasDefaultValue: true, primaryEligible: true, indexable: true}
};

const DATE_DEFINITION: FieldDefinition = {
  kind: FieldKind.Date,
  display: {label: "Date", icon: "calendarBlank"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(Object.keys(MinimalConfig).map(key => [key, false])),
    defaultValue: undefined,
    type: FieldKind.Date
  }),
  getDefaultValue: property => {
    const defaultDateLabels: {[key: string]: string} = {
      ":created_at": "Created At",
      ":updated_at": "Updated At"
    };
    return defaultDateLabels[property.default] || "";
  },
  getDisplayValue: value => {
    const date = new Date(value);
    return isValidDate(date) ? date : null;
  },
  getSaveReadyValue: value => {
    const defaultDateLabels: {[key: string]: string} = {
      "Created At": ":created_at",
      "Updated At": ":updated_at"
    };
    if (defaultDateLabels[value]) return new Date();
    const date = new Date(value);
    return isValidDate(date) ? date : null;
  },
  validateCreationForm: form => runYupValidation(DATE_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Date, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultDate as unknown as TypeProperties[keyof TypeProperties],
    configurationValues: MinimalConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Date,
      id: crypto.randomUUID(),
      description: undefined
    }) as TypeProperty,
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    return {
      ...base,
      default: form?.defaultValue?.length ? form.defaultValue : undefined
    };
  },
  capabilities: {hasDefaultValue: true, indexable: true}
};

const TEXTAREA_DEFINITION: FieldDefinition = {
  kind: FieldKind.Textarea,
  display: {label: "Textarea", icon: "formatColorText"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableConfig).map(key => [key, false])
    ),
    type: FieldKind.Textarea
  }),
  getDefaultValue: property => property.default || "",
  getDisplayValue: value => value || "",
  getSaveReadyValue: value => value || "",
  validateCreationForm: form => runYupValidation(TEXTAREA_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Textarea, properties, required),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Textarea,
      id: crypto.randomUUID(),
      description: undefined
    }) as TypeProperty,
  buildCreationFormApiProperty: buildBaseProperty,
  capabilities: {translatable: true, indexable: true}
};

const MULTISELECT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Multiselect,
  display: {label: "Select", icon: "formatListChecks"},
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
  getDefaultValue: property => property.default || "",
  getDisplayValue: value => value || "",
  getSaveReadyValue: value => value || [],
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
      id: crypto.randomUUID(),
      description: undefined
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
  capabilities: {enumerable: true, indexable: true}
};

const RELATION_DEFINITION: FieldDefinition = {
  kind: FieldKind.Relation,
  display: {label: "Relation", icon: "callMerge"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    fieldValues: {
      ...BASE_FORM_DEFAULTS.fieldValues,
      bucket: "",
      relationType: "",
      dependent: false
    },
    configurationValues: Object.fromEntries(
      Object.keys(RelationFieldConfig).map(key => [key, false])
    ),
    type: FieldKind.Relation
  }),
  getDefaultValue: property =>
    property.default || (property.relationType === "onetomany" ? [] : undefined),
  getDisplayValue: (value, property) => {
    if (!value) return null;
    const primaryKey = property?.relationState?.primaryKey;

    const initialFormattedValues = property?.relationState?.initialFormattedValues;
    const getValue = (v: {_id?: string; value?: string}) => v._id ?? v.value ?? v;
    const getLabel = (v: {[key: string]: string}) =>
      v[primaryKey] ??
      v.label ??
      initialFormattedValues?.label ??
      initialFormattedValues?.find(
        (i: {value: string; _id: string}) =>
          i.value === v.value || i.value === v._id || (typeof v === "string" && i.value === v)
      )?.label;

    if (property?.relationType === "onetomany") {
      const values = Array.isArray(value)
        ? value.map(i => ({value: getValue(i), label: getLabel(i)}))
        : [{value: getValue(value), label: getLabel(value)}];
      return values;
    }

    return {
      value: getValue(value),
      label: getLabel(value)
    };
  },
  getSaveReadyValue: (value, property) => {
    const displayValue = RELATION_DEFINITION.getDisplayValue(value, property);
    if (property?.relationType !== "onetomany") return displayValue?.value;
    const payload = Array.isArray(displayValue)
      ? displayValue.map(i => i.value)
      : displayValue?.value
        ? [displayValue?.value]
        : [];
    return payload;
  },
  validateCreationForm: form => runYupValidation(RELATION_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Relation, properties, required),
  buildValueProperty: (property, relationProps) =>
    ({
      ...property,
      type: FieldKind.Relation,
      className: styles.relationInput,
      ...relationProps,
      id: crypto.randomUUID(),
      description: undefined
    }) as TypeProperty,
  buildCreationFormProperties: (_, buckets?: BucketType[]) =>
    ({
      fieldValues: {
        ...BaseFields,
        bucket: {
          ...SpecializedInputs.bucket,
          enum: buckets?.map(b => ({label: b.title, value: b._id})) || []
        },
        relationType: SpecializedInputs.relationType
      },
      configurationValues: RelationFieldConfig
    }) as unknown as FieldCreationFormProperties,
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const fv = form.fieldValues;
    return {
      ...base,
      relationType: fv.relationType,
      bucketId: fv.bucket,
      dependent: fv.dependent || undefined
    };
  },
  capabilities: {indexable: true}
};

const LOCATION_DEFINITION: FieldDefinition = {
  kind: FieldKind.Location,
  display: {label: "Location", icon: "mapMarker"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(OnlyRequiredConfig).map(key => [key, false])
    ),
    type: FieldKind.Location
  }),
  getDefaultValue: property => property.default || DEFAULT_COORDINATES,
  getDisplayValue: value => {
    const locationType = getLocationType(value);
    const normalizedLocationByType = {
      geojson: value,
      latlng: {type: "Point", coordinates: [value?.lat, value?.lng]},
      none: null,
      unknown: DEFAULT_COORDINATES
    };
    return normalizedLocationByType[locationType];
  },
  getSaveReadyValue: value => {
    const displayValue = LOCATION_DEFINITION.getDisplayValue(value);
    if (displayValue === null) return null;
    return {lat: displayValue.coordinates[0], lng: displayValue.coordinates[1]};
  },
  validateCreationForm: form => runYupValidation(LOCATION_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Location, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: OnlyRequiredConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Location,
      id: crypto.randomUUID(),
      description: undefined
    }) as TypeProperty,
  buildCreationFormApiProperty: buildBaseProperty,
  capabilities: {indexable: true}
};

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

const ARRAY_DEFINITION: FieldDefinition = {
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
  getDefaultValue: property => property.default || [],
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
  buildValueProperty: (property, relationHandlers) =>
    ({
      ...property,
      type: FieldKind.Array,
      title: property.title,
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
      id: crypto.randomUUID(),
      description: undefined,
      className: styles.arrayInput,
    }) as TypeProperty,
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
  requiresInnerFields: form => form.fieldValues?.arrayType === "object",
  applyPresetLogic: (form, oldValues) =>
    form.fieldValues.arrayType === "string"
      ? applyPresetLogic(FieldKind.String, form, oldValues)
      : form,
  capabilities: {supportsInnerFields: true}
};

const OBJECT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Object,
  display: {label: "Object", icon: "dataObject"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    ),
    type: FieldKind.Object
  }),
  getDefaultValue: property => property.default || {},
  getDisplayValue: (value, properties) => {
    const result: Record<string, any> = {};
    const propertyArray = Object.values(properties?.properties || properties || {}) as Property[];
    propertyArray.forEach(property => {
      if (property.type === FieldKind.Object) {
        const nestedValue = value?.[property.title];
        result[property.title] = OBJECT_DEFINITION.getDisplayValue(
          nestedValue,
          property.properties as Property
        );
      } else if (property.type === FieldKind.Location) {
        const formattedValue = LOCATION_DEFINITION.getDisplayValue(
          value?.[property.title],
          property
        );
        result[property.title] = formattedValue ?? DEFAULT_COORDINATES;
      } else if (property.type === FieldKind.Number) {
        const formattedValue = NUMBER_DEFINITION.getDisplayValue(value?.[property.title], property);
        result[property.title] = formattedValue ?? "";
      } else {
        const field = FIELD_REGISTRY?.[property.type as FieldKind];
        const fn = field?.getDisplayValue as ((v: any, p: Property) => any) | undefined;
        result[property.title] = fn?.(value?.[property.title], property);
      }
    });
    return result;
  },
  getSaveReadyValue: (value, properties) => {
    const result: Record<string, any> = {};
    const propertyArray = Object.values(properties?.properties || properties || {}) as Property[];
    propertyArray.forEach(property => {
      if (property.type === FieldKind.Object) {
        const nestedValue = value?.[property.title];
        result[property.title] = OBJECT_DEFINITION.getSaveReadyValue(
          nestedValue,
          property.properties as Property
        );
      } else {
        const field = FIELD_REGISTRY?.[property.type as FieldKind];
        const fn = field?.getSaveReadyValue as ((v: any, p: Property) => any) | undefined;
        result[property.title] = fn?.(value?.[property.title], property);
      }
    });
    return result;
  },
  validateCreationForm: form => runYupValidation(OBJECT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Object, properties, required),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableMinimalConfig
  }),
  buildValueProperty: (rawProperty, relationHandlers) => {
    if (!rawProperty) {
      return {
        type: FieldKind.Object,
        properties: {},
        description: undefined,
        id: crypto.randomUUID(),
        className: styles.objectInput
      } as TypeProperty;
    }

    const {
      getOptionsMap = {},
      loadMoreOptionsMap = {},
      searchOptionsMap = {},
      relationStates = {}
    } = (relationHandlers || {}) as ObjectInputRelationHandlers;

    const sourceProperties = rawProperty?.properties || {};
    const builtProperties = Object.fromEntries(
      Object.entries(sourceProperties as {[key: string]: Property}).map(([propKey, property]) => {
        const bucketId = property?.bucketId;

        let builtChild;
        switch (property.type) {
          case "object": {
            builtChild = OBJECT_DEFINITION.buildValueProperty(property, relationHandlers);
            break;
          }
          case "array": {
            builtChild = ARRAY_DEFINITION.buildValueProperty(property, relationHandlers);
            break;
          }
          case "relation": {
            const relationHandlerBundle = {
              getOptions: (getOptionsMap as TypeGetOptionsMap)?.[bucketId],
              loadMoreOptions: (loadMoreOptionsMap as TypeGetMoreOptionsMap)?.[bucketId],
              searchOptions: (searchOptionsMap as TypeSearchOptionsMap)?.[bucketId],
              relationState: (relationStates as Record<string, RelationState | undefined>)?.[
                bucketId
              ]
            };
            builtChild = RELATION_DEFINITION.buildValueProperty(
              property,
              relationHandlerBundle as RelationInputRelationHandlers | ObjectInputRelationHandlers
            );
            break;
          }
          default: {
            const field = FIELD_REGISTRY[property.type];
            builtChild = field?.buildValueProperty(property);
            break;
          }
        }

        return [propKey, builtChild];
      })
    );

    const result = {
      ...(rawProperty as Property),
      type: FieldKind.Object,
      properties: builtProperties,
      description: undefined,
      id: crypto.randomUUID(),
      className: styles.objectInput
    } as TypeProperty;

    return result;
  },
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const properties = Array.isArray(form.innerFields)
      ? form.innerFields.reduce<Record<string, Property>>((acc, inner) => {
          const innerDef = FIELD_REGISTRY[inner.type as FieldKind];
          if (innerDef?.buildCreationFormApiProperty) {
            acc[inner.fieldValues.title] = innerDef.buildCreationFormApiProperty(inner);
          } else {
            throw new Error(`Cannot build property for field type ${inner?.type}`);
          }
          return acc;
        }, {})
      : undefined;
    return {
      ...base,
      properties
    } as Property;
  },
  requiresInnerFields: _ => true,
  capabilities: {supportsInnerFields: true}
};

const FILE_DEFINITION: FieldDefinition = {
  kind: FieldKind.File,
  display: {label: "File", icon: "imageMultiple"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    ),
    type: FieldKind.File
  }),
  getDefaultValue: property => property.default,
  getDisplayValue: value => value || null,
  getSaveReadyValue: value => value || null,
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
      id: crypto.randomUUID(),
      description: undefined
    }) as TypeProperty,
  buildCreationFormApiProperty: buildBaseProperty,
  capabilities: {}
};

const RICHTEXT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Richtext,
  display: {label: "Richtext", icon: "formatAlignCenter"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    ),
    type: FieldKind.Richtext
  }),
  getDefaultValue: property => property.default || "",
  getDisplayValue: value => value || "",
  getSaveReadyValue: value => value || "",
  validateCreationForm: form => runYupValidation(RICHTEXT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Richtext, properties, required),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableMinimalConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Richtext,
      id: crypto.randomUUID(),
      description: undefined,
      placeholder: "Enter your text here"
    }) as TypeProperty,
  buildCreationFormApiProperty: buildBaseProperty,
  capabilities: {translatable: true}
};

const JSON_DEFINITION: FieldDefinition = {
  kind: FieldKind.Json,
  display: {label: "JSON", icon: "dataObject"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(
      Object.keys(OnlyRequiredConfig).map(key => [key, false])
    ),
    type: FieldKind.Json
  }),
  getDefaultValue: property => property.default,
  getDisplayValue: value => JSON.parse(value),
  getSaveReadyValue: value => JSON.stringify(value),
  validateCreationForm: form => runYupValidation(JSON_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Json, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: OnlyRequiredConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Object, //FieldKind.Json is not in TypeInputTypeMap yet, so we use Object for now, will be fixed later
      id: crypto.randomUUID(),
      description: undefined
    }) as TypeProperty,
  buildCreationFormApiProperty: buildBaseProperty,
  capabilities: {indexable: true}
};

const COLOR_DEFINITION: FieldDefinition = {
  kind: FieldKind.Color,
  display: {label: "Color", icon: "palette"},
  creationFormDefaultValues: freezeFormDefaults({
    ...BASE_FORM_DEFAULTS,
    configurationValues: Object.fromEntries(Object.keys(MinimalConfig).map(key => [key, false])),
    type: FieldKind.Color
  }),
  getDefaultValue: property => property.default || "",
  getDisplayValue: value => value ?? "#000000",
  getSaveReadyValue: value => value ?? "",
  validateCreationForm: form => runYupValidation(COLOR_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties, required) =>
    validateFieldValue(value, FieldKind.Color, properties, required),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: MinimalConfig
  }),
  buildValueProperty: property =>
    ({
      ...property,
      type: FieldKind.Color as keyof TypeInputTypeMap,
      id: crypto.randomUUID(),
      description: undefined
    }) as TypeProperty,
  buildCreationFormApiProperty: buildBaseProperty,
  capabilities: {hasDefaultValue: true, indexable: true}
};

export const FIELD_REGISTRY: Partial<Record<FieldKind, FieldDefinition>> = {
  [FieldKind.String]: STRING_DEFINITION,
  [FieldKind.Number]: NUMBER_DEFINITION,
  [FieldKind.Date]: DATE_DEFINITION,
  [FieldKind.Boolean]: BOOLEAN_DEFINITION,
  [FieldKind.Textarea]: TEXTAREA_DEFINITION,
  [FieldKind.Multiselect]: MULTISELECT_DEFINITION,
  [FieldKind.Relation]: RELATION_DEFINITION,
  [FieldKind.Location]: LOCATION_DEFINITION,
  [FieldKind.Array]: ARRAY_DEFINITION,
  [FieldKind.Object]: OBJECT_DEFINITION,
  [FieldKind.File]: FILE_DEFINITION,
  [FieldKind.Richtext]: RICHTEXT_DEFINITION,
  [FieldKind.Color]: COLOR_DEFINITION,
  [FieldKind.Json]: JSON_DEFINITION
};
