/**
 * Field Registry
 * ------------------------------------------------------------
 * Central access to field definitions. Each definition encapsulates
 * defaults, property construction, parsing, formatting and validation.
 */

import {BASE_FORM_DEFAULTS, freezeFormDefaults} from "./defaults";
import {applyPresetLogic} from "./presets";
import {
  type FieldCreationFormProperties,
  type FieldDefinition,
  type FieldFormState,
  FieldKind
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
import type {BucketType, Property} from "src/services/bucketService";
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
  getDefaultValue: property => property.default,
  validateCreationForm: form => runYupValidation(STRING_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.String, properties),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultString,
    configurationValues: isInnerField ? MinimalConfig : TranslatableConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.String,
    title: property.title,
    description: property.description,
    enum: property.enum,
    pattern: property.pattern
  }),
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const defaultValue = form.defaultValue?.default || form.defaultValue || "";
    return {
      ...base,
      default: typeof defaultValue === "string" && defaultValue.length ? defaultValue : undefined
    };
  },
  getFormattedValue: value => (value == null ? "" : String(value)),
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
  validateCreationForm: form => runYupValidation(NUMBER_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Number, properties),
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
  buildValueProperty: property => ({
    type: FieldKind.Number as keyof TypeInputTypeMap,
    title: property.title,
    description: property.description,
    enum: property.enum
  }),
  getDefaultValue: property => property.default,
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
  getFormattedValue: value => (value == null ? "" : value),
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
  validateCreationForm: form => runYupValidation(BOOLEAN_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Boolean, properties),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultBoolean,
    configurationValues: isInnerField ? MinimalInnerFieldConfig : PrimaryAndIndexConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Boolean as keyof TypeInputTypeMap,
    title: property.title,
    description: property.description
  }),
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const def = form.defaultValue;
    return {
      ...base,
      default: def
    };
  },
  getFormattedValue: v => (v === true ? "✔" : v === false ? "✘" : ""),
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
  validateCreationForm: form => runYupValidation(DATE_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Date, properties),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    defaultValue: DefaultInputs.defaultDate as unknown as TypeProperties[keyof TypeProperties],
    configurationValues: MinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Date,
    title: property.title,
    description: property.description
  }),
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    return {
      ...base,
      default: form?.defaultValue?.length ? form.defaultValue : undefined
    };
  },
  getFormattedValue: v => {
    if (!v) return "";
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toISOString().split("T")[0];
    } catch {
      return String(v);
    }
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
  validateCreationForm: form => runYupValidation(TEXTAREA_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Textarea, properties),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Textarea,
    title: property.title,
    description: property.description
  }),
  buildCreationFormApiProperty: buildBaseProperty,
  getFormattedValue: v => (v == null ? "" : String(v)),
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
  validateCreationForm: form => runYupValidation(MULTISELECT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) =>
    validateFieldValue(value, FieldKind.Multiselect, properties),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: MinimalConfig,
    presetValues: PresetPanel,
    multipleSelectionTab: {
      multipleSelectionType: SpecializedInputs.multipleSelectionType,
      maxItems: ValidationInputs.maxItems
    }
  }),
  buildValueProperty: property => ({
    type: FieldKind.Multiselect,
    title: property.title,
    description: property.description,
    enum: property.enum
  }),
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const ms = form.multipleSelectionTab;
    const pv = form.presetValues;
    return {
      ...base,
      items: {
        type: ms?.multipleSelectionType,
        enum: pv.enumeratedValues,
        pattern: pv.pattern
      },
      maxItems: ms?.maxItems === "" ? undefined : ms?.maxItems
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
  getFormattedValue: v => (Array.isArray(v) ? v.join(", ") : ""),
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
  validateCreationForm: form => runYupValidation(RELATION_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Relation, properties),
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
  buildValueProperty: property => ({
    type: FieldKind.Relation,
    title: property.title,
    description: property.description
    // NEEDS TO WAY TO DEFINE
    // getOptions?: () => Promise<TypeLabeledValue[]>;
    // loadMoreOptions?: () => Promise<TypeLabeledValue[]>;
    // searchOptions?: (value: string) => Promise<TypeLabeledValue[]>;
    // totalOptionsLength?: number;
    // THESE ARE NECESSARY FOR RELATION FIELDS
  }),
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const fv = form.fieldValues;
    const cv = form.configurationValues;
    return {
      ...base,
      relationType: fv.relationType,
      bucketId: fv.bucket,
      dependent: cv.dependent || undefined
    };
  },
  getFormattedValue: v => {
    if (!v) return "";
    if (typeof v === "string") return v;
    return v.title || v.name || v._id || v.id || "";
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
  validateCreationForm: form => runYupValidation(LOCATION_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Location, properties),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: OnlyRequiredConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Location,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => {
    if (!v || typeof v !== "object") return "";
    if (Array.isArray(v.coordinates)) {
      const coords = v.coordinates;
      if (coords.length >= 2) return `${coords[0]},${coords[1]}`;
    }
    if ("latitude" in v && "longitude" in v) return `${v.latitude},${v.longitude}`;
    return "";
  },
  buildCreationFormApiProperty: buildBaseProperty,
  capabilities: {indexable: true}
};

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
      pattern: "",
      uniqueItems: false,
      defaultString: "",
      multipleSelectionType: "",
      minItems: "",
      maxItems: ""
    },
    configurationValues: Object.fromEntries(
      Object.keys(TranslatableMinimalConfig).map(key => [key, false])
    ),
    type: FieldKind.Array
  }),
  getDefaultValue: property => property.default,
  validateCreationForm: form => runYupValidation(ARRAY_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Array, properties),
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
        valueType: "string",
        renderCondition: {field: "makeEnumerated", equals: true}
      },
      definePattern: {
        ...ValidationInputs.definePattern,
        renderCondition: {field: "arrayType", equals: "string"}
      },
      pattern: {
        ...ValidationInputs.pattern,
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
      pattern: PresetPanel.pattern,
      enumeratedValues: PresetPanel.enumeratedValues
    },
    configurationValues: isInnerField ? MinimalConfig : TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Array,
    title: property.title,
    description: property.description,
    items: property.items
  }),
  buildCreationFormApiProperty: form => {
    const base = buildBaseProperty(form);
    const fv = form.fieldValues;
    const pv = form.presetValues || {};

    const defaultValueMap: {[key: string]: number | string | boolean} = {
      string: fv.defaultString,
      number: fv.defaultNumber,
      boolean: fv.defaultBoolean
    };

    const item: Property = {
      type: fv.arrayType,
      title: fv.arrayItemTitle,
      description: fv.arrayItemDescription?.length ? fv.arrayItemDescription : undefined,
      default: defaultValueMap[fv.arrayType]
    };

    if (fv.enumeratedValues?.length) item.enum = fv.enumeratedValues;
    if (pv.pattern?.length) item.pattern = pv.pattern;
    if (fv.maxNumber != null) item.maximum = fv.maxNumber === "" ? undefined : fv.maxNumber;
    if (fv.minNumber != null) item.minimum = fv.minNumber === "" ? undefined : fv.minNumber;

    if (fv.arrayType === "multiselect") {
      item.items = {
        type: fv.multipleSelectionType,
        enum: Array.isArray(fv.chip) && fv.chip.length ? fv.chip : undefined
      };
      item.maxItems = fv.maxItems === "" ? undefined : fv.maxItems;
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
      maxItems:
        fv.arrayType === "multiselect" ? undefined : fv.maxItems === "" ? undefined : fv.maxItems,
      minItems: (fv.minItems === "" ? undefined : fv.minItems) ?? undefined,
      uniqueItems: (fv.uniqueItems === "" ? undefined : fv.uniqueItems) ?? undefined,
      items: item
    };
  },
  requiresInnerFields: form => form.fieldValues?.arrayType === "object",
  applyPresetLogic: (form, oldValues) =>
    form.fieldValues.arrayType === "string"
      ? applyPresetLogic(FieldKind.String, form, oldValues)
      : form,
  applySelectionTypeLogic: (form, properties) => {
    const newSelectionType = form.fieldValues?.arrayType;
    const updatedForm = {
      ...form,
      fieldValues: {
        ...form.fieldValues,
        enumeratedValues:
          newSelectionType === "string"
            ? form.fieldValues.enumeratedValues.map((v: string | number) => String(v))
            : newSelectionType === "number"
              ? form.fieldValues.enumeratedValues
                  .map((v: string | number) => Number(v))
                  .filter((v: number) => !isNaN(v))
              : undefined,
        makeEnumerated: ["string", "number"].includes(newSelectionType)
          ? form.fieldValues.makeEnumerated
          : false
      }
    };
    const updatedFieldProperties = {
      ...properties,
      enumeratedValues: {
        ...SpecializedInputs.enumeratedValues,
        renderCondition: {field: "makeEnumerated", equals: true},
        valueType: newSelectionType
      }
    };
    return {updatedForm, updatedFieldProperties};
  },
  getFormattedValue: v => (Array.isArray(v) ? `${v.length} item${v.length === 1 ? "" : "s"}` : ""),
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
  validateCreationForm: form => runYupValidation(OBJECT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Object, properties),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Object,
    title: property.title,
    description: property.description,
    properties: property.properties
  }),
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
  getDefaultValue: property => property.default,
  getFormattedValue: v => (v && typeof v === "object" ? `{${Object.keys(v).length}}` : ""),
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
  validateCreationForm: form => runYupValidation(FILE_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.File, properties),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.File,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (v && typeof v === "object") return v.originalName || v.name || "📎";
    return "📎";
  },
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
  validateCreationForm: form => runYupValidation(RICHTEXT_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Richtext, properties),
  buildCreationFormProperties: isInnerField => ({
    fieldValues: BaseFields,
    configurationValues: isInnerField ? MinimalConfig : TranslatableMinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Richtext,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => (v ? "[rich]" : ""),
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
  validateCreationForm: form => runYupValidation(JSON_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Json, properties),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: OnlyRequiredConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Object,
    title: property.title,
    description: property.description
  }),
  getFormattedValue: v => {
    if (!v) return "";
    try {
      const str = typeof v === "string" ? v : JSON.stringify(v);
      return str.length > 20 ? str.slice(0, 20) + "…" : str;
    } catch {
      return "{…}";
    }
  },
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
  validateCreationForm: form => runYupValidation(COLOR_FIELD_CREATION_FORM_SCHEMA, form),
  validateValue: (value, properties) => validateFieldValue(value, FieldKind.Color, properties),
  buildCreationFormProperties: () => ({
    fieldValues: BaseFields,
    configurationValues: MinimalConfig
  }),
  buildValueProperty: property => ({
    type: FieldKind.Color as keyof TypeInputTypeMap,
    title: property.title,
    description: property.description
  }),
  getDefaultValue: property => property.default || "#000000",
  getFormattedValue: v => (v ? String(v).toUpperCase() : ""),
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
