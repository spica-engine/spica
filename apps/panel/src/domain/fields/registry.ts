/**
 * Field Registry
 * ------------------------------------------------------------
 * Central access to field definitions. Each definition encapsulates
 * defaults, property construction, parsing, formatting and validation.
 */

//import type {TypeInputTypeMap} from "../../hooks/useInputRepresenter";

import {
  BASE_FORM_DEFAULTS,
  cloneFormDefaults,
  resolveDefault,
  BASE_PRESET_DEFAULTS,
  freezeFormDefaults
} from "./defaults";
import {type FieldDefinition, type FieldFormDefaults, FieldKind} from "./types";
import {
  runYupValidation,
  STRING_SCHEMA,
  NUMBER_SCHEMA,
  BOOLEAN_SCHEMA,
  DATE_SCHEMA,
  TEXTAREA_SCHEMA,
  MULTISELECT_SCHEMA,
  RELATION_SCHEMA,
  LOCATION_SCHEMA,
  ARRAY_SCHEMA,
  OBJECT_SCHEMA,
  FILE_SCHEMA,
  RICHTEXT_SCHEMA,
  JSON_SCHEMA,
  COLOR_SCHEMA
} from "./validation";

export function resolveFieldKind(input: string): FieldKind | undefined {
  if (!input) return undefined;
  if ((Object.values(FieldKind) as string[]).includes(input)) return input as FieldKind;
  return SYNONYM_MAP[input.toLowerCase()];
}

export function getFieldDefinition(kind: FieldKind): FieldDefinition | undefined {
  return FIELD_REGISTRY[kind];
}

export function isFieldKind(value: string): value is FieldKind {
  return (Object.values(FieldKind) as string[]).includes(value);
}

function buildOptions(configurationValues: Record<string, any>): {
  [key: string]: any;
} {
  // Mirrors legacy createFieldProperty options construction
  const {index, uniqueValues, translate, readOnly, primaryField, requiredField} =
    configurationValues || {};
  return {
    position: "bottom",
    index: index || undefined,
    unique: uniqueValues || undefined,
    translate: translate || undefined,
    primary: primaryField || undefined,
    required: requiredField || undefined,
    readOnly: readOnly || undefined
  };
}

// ---------------------------------------------------------------------------
// Field Core Types
// ---------------------------------------------------------------------------
// Types imported from field-types to avoid duplication.

// ---------------------------------------------------------------------------
// Field Definitions
// ---------------------------------------------------------------------------
const STRING_FORM_DEFAULTS_SEED = freezeFormDefaults(
  (() => {
    const d = BASE_FORM_DEFAULTS;
    d.defaultValue = {defaultString: ""};
    return d;
  })()
);
const STRING_DEFINITION: FieldDefinition = {
  kind: FieldKind.String,
  display: {label: "String", icon: "formatQuoteClose"},
  get formDefaults() {
    return cloneFormDefaults(STRING_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.String as any,//keyof TypeInputTypeMap,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    default: (() => {
      const val = resolveDefault(form, ["defaultString", "default"]);
      return typeof val === "string" && val.length ? val : undefined;
    })(),
    enum:
      Array.isArray(form.presetValues.enumeratedValues) && form.presetValues.enumeratedValues.length
        ? form.presetValues.enumeratedValues
        : undefined,
    pattern:
      form.presetValues.definePattern && form.presetValues.regularExpression?.length
        ? form.presetValues.regularExpression
        : undefined,
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => {
    if (!property) return {};
    return {
      type: FieldKind.String,
      fieldValues: {
        title: property.title || "",
        description: property.description || ""
      },
      defaultValue:
        property.default != null ? {defaultString: property.default} : {defaultString: ""},
      presetValues: {
        ...BASE_PRESET_DEFAULTS,
        enumeratedValues: property.enum || [],
        regularExpression: property.pattern || "",
        makeEnumerated: Array.isArray(property.enum) && property.enum.length > 0,
        definePattern: typeof property.pattern === "string" && property.pattern.length > 0
      }
    };
  },
  validate: form => runYupValidation(STRING_SCHEMA, form),
  getFormattedValue: value => (value == null ? "" : String(value)),
  capabilities: {
    enumerable: true,
    pattern: true,
    hasDefaultValue: true,
    translatable: true,
    primaryEligible: true,
    uniqueEligible: true,
    indexable: true
  },
  meta: {
    defaultInputs: [{key: "defaultString", type: "string", title: "Default Value"}]
  }
};

const NUMBER_FORM_DEFAULTS_SEED = freezeFormDefaults(
  (() => {
    const d = BASE_FORM_DEFAULTS;
    d.defaultValue = {defaultNumber: undefined};
    return d;
  })()
);
const NUMBER_DEFINITION: FieldDefinition = {
  kind: FieldKind.Number,
  display: {label: "Number", icon: "numericBox"},
  get formDefaults() {
    return cloneFormDefaults(NUMBER_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Number,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    default: resolveDefault(form, ["defaultNumber", "default"]),
    minimum: (form.fieldValues as any).minimum ?? undefined,
    maximum: (form.fieldValues as any).maximum ?? undefined,
    enum:
      Array.isArray((form.fieldValues as any).enumeratedValues) &&
      (form.fieldValues as any).enumeratedValues.length
        ? (form.fieldValues as any).enumeratedValues
        : undefined,
    pattern:
      form.presetValues.definePattern && form.presetValues.regularExpression?.length
        ? form.presetValues.regularExpression
        : undefined,
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => {
    if (!property) return {};
    return {
      type: FieldKind.Number,
      fieldValues: {
        title: property.title || "",
        description: property.description || "",
        minimum: property.minimum,
        maximum: property.maximum,
        enumeratedValues: property.enum || []
      },
      defaultValue:
        property.default != null ? {defaultNumber: property.default} : {defaultNumber: undefined},
      presetValues: {
        ...BASE_PRESET_DEFAULTS,
        makeEnumerated: Array.isArray(property.enum) && property.enum.length > 0,
        regularExpression: property.pattern || "",
        definePattern: typeof property.pattern === "string" && property.pattern.length > 0
      }
    };
  },
  validate: form => runYupValidation(NUMBER_SCHEMA, form),
  getFormattedValue: value => (value == null ? "" : value),
  capabilities: {
    enumerable: true,
    numericConstraints: true,
    pattern: true,
    hasDefaultValue: true,
    primaryEligible: true,
    uniqueEligible: true,
    indexable: true
  },
  meta: {
    defaultInputs: [{key: "defaultNumber", type: "number", title: "Default Value"}]
  }
};

const BOOLEAN_FORM_DEFAULTS_SEED = freezeFormDefaults(
  (() => {
    const d = BASE_FORM_DEFAULTS;
    d.defaultValue = {defaultBoolean: false};
    return d;
  })()
);
const BOOLEAN_DEFINITION: FieldDefinition = {
  kind: FieldKind.Boolean,
  display: {label: "Boolean", icon: "checkboxBlankOutline"},
  get formDefaults() {
    return cloneFormDefaults(BOOLEAN_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Boolean,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    default:
      form.defaultValue.defaultBoolean !== undefined
        ? form.defaultValue.defaultBoolean
        : resolveDefault(form, ["default", "defaultBoolean"]),
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.Boolean,
    fieldValues: {
      title: property?.title || "",
      description: property?.description || ""
    },
    defaultValue:
      property?.default !== undefined
        ? {defaultBoolean: property.default}
        : {defaultBoolean: false},
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(BOOLEAN_SCHEMA, form),
  getFormattedValue: v => (v === true ? "✔" : v === false ? "✘" : ""),
  capabilities: {hasDefaultValue: true, primaryEligible: true, indexable: true},
  meta: {defaultInputs: [{key: "defaultBoolean", type: "boolean", title: "Default Value"}]}
};

const DATE_FORM_DEFAULTS_SEED = freezeFormDefaults(
  (() => {
    const d = BASE_FORM_DEFAULTS;
    d.defaultValue = {defaultDate: ""};
    return d;
  })()
);
const DATE_DEFINITION: FieldDefinition = {
  kind: FieldKind.Date,
  display: {label: "Date", icon: "calendarBlank"},
  get formDefaults() {
    return cloneFormDefaults(DATE_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Date,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    default: resolveDefault(form, ["defaultDate", "default"]),
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.Date,
    fieldValues: {title: property?.title || "", description: property?.description || ""},
    defaultValue: {defaultDate: property?.default || ""},
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(DATE_SCHEMA, form),
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
  capabilities: {hasDefaultValue: true, indexable: true},
  meta: {
    defaultInputs: [
      {
        key: "defaultDate",
        type: "macro",
        title: "Default Date",
        macros: ["", ":created_at", ":updated_at"]
      }
    ]
  }
};

const TEXTAREA_FORM_DEFAULTS_SEED = freezeFormDefaults(BASE_FORM_DEFAULTS);
const TEXTAREA_DEFINITION: FieldDefinition = {
  kind: FieldKind.Textarea,
  display: {label: "Textarea", icon: "formatColorText"},
  get formDefaults() {
    return cloneFormDefaults(TEXTAREA_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Textarea,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.Textarea,
    fieldValues: {title: property?.title || "", description: property?.description || ""},
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(TEXTAREA_SCHEMA, form),
  getFormattedValue: v => (v == null ? "" : String(v)),
  capabilities: {translatable: true, indexable: true}
};

const MULTISELECT_FORM_DEFAULTS_SEED = freezeFormDefaults(
  (() => {
    const d = BASE_FORM_DEFAULTS;
    (d.fieldValues as any).multipleSelectionType = "string";
    (d.fieldValues as any).maxItems = undefined;
    (d.fieldValues as any).chip = [];
    return d;
  })()
);
const MULTISELECT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Multiselect,
  display: {label: "Multiple Selection", icon: "formatListChecks"},
  get formDefaults() {
    return cloneFormDefaults(MULTISELECT_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Multiselect,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    maxItems: (form.fieldValues as any).maxItems || undefined,
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.Multiselect,
    fieldValues: {
      title: property?.title || "",
      description: property?.description || "",
      multipleSelectionType: property?.items?.type || "string",
      chip: property?.items?.enum || [],
      maxItems: property?.maxItems
    },
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(MULTISELECT_SCHEMA, form),
  getFormattedValue: v => (Array.isArray(v) ? v.join(", ") : ""),
  capabilities: {enumerable: true, indexable: true}
};

const RELATION_FORM_DEFAULTS_SEED = freezeFormDefaults(
  (() => {
    const d = BASE_FORM_DEFAULTS;
    (d.fieldValues as any).bucket = "";
    (d.fieldValues as any).relationType = "one";
    (d.fieldValues as any).dependent = false;
    return d;
  })()
);
const RELATION_DEFINITION: FieldDefinition = {
  kind: FieldKind.Relation,
  display: {label: "Relation", icon: "callMerge"},
  get formDefaults() {
    return cloneFormDefaults(RELATION_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Relation,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    bucketId: (form.fieldValues as any).bucket || undefined,
    relationType: (form.fieldValues as any).relationType || undefined,
    dependent: (form.fieldValues as any).dependent || undefined,
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.Relation,
    fieldValues: {
      title: property?.title || "",
      description: property?.description || "",
      bucket: property?.bucketId || property?.bucket,
      relationType: property?.relationType,
      dependent: property?.dependent
    },
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(RELATION_SCHEMA, form),
  getFormattedValue: v => {
    if (!v) return "";
    if (typeof v === "string") return v;
    return (v as any).title || (v as any).name || (v as any)._id || (v as any).id || "";
  },
  capabilities: {indexable: true}
};

const LOCATION_FORM_DEFAULTS_SEED = freezeFormDefaults(BASE_FORM_DEFAULTS);
const LOCATION_DEFINITION: FieldDefinition = {
  kind: FieldKind.Location,
  display: {label: "Location", icon: "mapMarker"},
  get formDefaults() {
    return cloneFormDefaults(LOCATION_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Location,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.Location,
    fieldValues: {title: property?.title || "", description: property?.description || ""},
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(LOCATION_SCHEMA, form),
  getFormattedValue: v => {
    if (!v || typeof v !== "object") return "";
    if (Array.isArray((v as any).coordinates)) {
      const coords = (v as any).coordinates;
      if (coords.length >= 2) return `${coords[0]},${coords[1]}`;
    }
    if ("latitude" in (v as any) && "longitude" in (v as any))
      return `${(v as any).latitude},${(v as any).longitude}`;
    return "";
  },
  capabilities: {indexable: true}
};

const ARRAY_FORM_DEFAULTS_SEED = freezeFormDefaults(
  (() => {
    const d = BASE_FORM_DEFAULTS;
    (d.fieldValues as any).arrayType = "string";
    return d;
  })()
);
const ARRAY_DEFINITION: FieldDefinition = {
  kind: FieldKind.Array,
  display: {label: "Array", icon: "ballot"},
  get formDefaults() {
    return cloneFormDefaults(ARRAY_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => {
    const base: any = {
      type: FieldKind.Array,
      title: form.fieldValues.title || "",
      description: form.fieldValues.description || undefined,
      minItems: (form.fieldValues as any).minItems || undefined,
      maxItems: (form.fieldValues as any).maxItems || undefined,
      uniqueItems: (form.fieldValues as any).uniqueItems || undefined,
      options: buildOptions(form.configurationValues)
    };
    const itemType = (form.fieldValues as any).arrayType || "string";
    if (itemType === "object") {
      base.items = {type: "object", properties: {}};
    } else if (itemType === "multiselect") {
      base.items = {
        type: FieldKind.Multiselect,
        items: {
          type: (form.fieldValues as any).multipleSelectionType || "string",
          enum:
            Array.isArray((form.fieldValues as any).chip) && (form.fieldValues as any).chip.length
              ? (form.fieldValues as any).chip
              : undefined
        },
        maxItems: (form.fieldValues as any).maxItems || undefined
      };
    } else {
      const item: any = {type: itemType};
      if (
        itemType === "number" &&
        Array.isArray(form.presetValues.enumeratedValues) &&
        form.presetValues.enumeratedValues.length
      )
        item.enum = form.presetValues.enumeratedValues;
      if (
        itemType === "number" &&
        form.presetValues.definePattern &&
        form.presetValues.regularExpression?.length
      )
        item.pattern = form.presetValues.regularExpression;
      const def = resolveDefault(form, ["defaultString", "defaultNumber", "defaultBoolean"]);
      if (def !== undefined && def !== "") item.default = def;
      base.items = item;
    }
    return base;
  },
  parseProperty: property => ({
    type: FieldKind.Array,
    fieldValues: {
      title: property?.title || "",
      description: property?.description || "",
      arrayType: property?.items?.type || "string"
    },
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(ARRAY_SCHEMA, form),
  getFormattedValue: v => (Array.isArray(v) ? `${v.length} item${v.length === 1 ? "" : "s"}` : ""),
  capabilities: {supportsInnerFields: true}
};

const OBJECT_FORM_DEFAULTS_SEED = freezeFormDefaults(BASE_FORM_DEFAULTS);
const OBJECT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Object,
  display: {label: "Object", icon: "dataObject"},
  get formDefaults() {
    return cloneFormDefaults(OBJECT_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Object,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    properties: {},
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.Object,
    fieldValues: {title: property?.title || "", description: property?.description || ""},
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(OBJECT_SCHEMA, form),
  getFormattedValue: v => (v && typeof v === "object" ? `{${Object.keys(v).length}}` : ""),
  capabilities: {supportsInnerFields: true}
};

const FILE_FORM_DEFAULTS_SEED = freezeFormDefaults(BASE_FORM_DEFAULTS);
const FILE_DEFINITION: FieldDefinition = {
  kind: FieldKind.File,
  display: {label: "File", icon: "imageMultiple"},
  get formDefaults() {
    return cloneFormDefaults(FILE_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.File,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.File,
    fieldValues: {title: property?.title || "", description: property?.description || ""},
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(FILE_SCHEMA, form),
  getFormattedValue: v => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (v && typeof v === "object") return (v as any).originalName || (v as any).name || "📎";
    return "📎";
  },
  capabilities: {}
};

const RICHTEXT_FORM_DEFAULTS_SEED = freezeFormDefaults(BASE_FORM_DEFAULTS);
const RICHTEXT_DEFINITION: FieldDefinition = {
  kind: FieldKind.Richtext,
  display: {label: "Richtext", icon: "formatAlignCenter"},
  get formDefaults() {
    return cloneFormDefaults(RICHTEXT_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Richtext,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.Richtext,
    fieldValues: {title: property?.title || "", description: property?.description || ""},
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(RICHTEXT_SCHEMA, form),
  getFormattedValue: v => (v ? "[rich]" : ""),
  capabilities: {translatable: true}
};

const JSON_FORM_DEFAULTS_SEED = freezeFormDefaults(BASE_FORM_DEFAULTS);
const JSON_DEFINITION: FieldDefinition = {
  kind: FieldKind.Json,
  display: {label: "JSON", icon: "dataObject"},
  get formDefaults() {
    return cloneFormDefaults(JSON_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Json as any,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.Json,
    fieldValues: {title: property?.title || "", description: property?.description || ""},
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(JSON_SCHEMA, form),
  getFormattedValue: v => {
    if (!v) return "";
    try {
      const str = typeof v === "string" ? v : JSON.stringify(v);
      return str.length > 20 ? str.slice(0, 20) + "…" : str;
    } catch {
      return "{…}";
    }
  },
  capabilities: {indexable: true}
};

const COLOR_FORM_DEFAULTS_SEED = freezeFormDefaults(BASE_FORM_DEFAULTS);
const COLOR_DEFINITION: FieldDefinition = {
  kind: FieldKind.Color,
  display: {label: "Color", icon: "palette"},
  get formDefaults() {
    return cloneFormDefaults(COLOR_FORM_DEFAULTS_SEED);
  },
  buildProperty: form => ({
    type: FieldKind.Color,
    title: form.fieldValues.title || "",
    description: form.fieldValues.description || undefined,
    options: buildOptions(form.configurationValues)
  }),
  parseProperty: property => ({
    type: FieldKind.Color,
    fieldValues: {title: property?.title || "", description: property?.description || ""},
    presetValues: {...BASE_PRESET_DEFAULTS}
  }),
  validate: form => runYupValidation(COLOR_SCHEMA, form),
  getFormattedValue: v => (v ? String(v).toUpperCase() : ""),
  capabilities: {hasDefaultValue: true, indexable: true},
  meta: {defaultInputs: [{key: "defaultColor", type: "string", title: "Default Color"}]}
};

export const FIELD_REGISTRY: Partial<Record<FieldKind, FieldDefinition>> = {
  [FieldKind.String]: STRING_DEFINITION,
  [FieldKind.Number]: NUMBER_DEFINITION,
  [FieldKind.Boolean]: BOOLEAN_DEFINITION,
  [FieldKind.Date]: DATE_DEFINITION,
  [FieldKind.Textarea]: TEXTAREA_DEFINITION,
  [FieldKind.Multiselect]: MULTISELECT_DEFINITION,
  [FieldKind.Relation]: RELATION_DEFINITION,
  [FieldKind.Location]: LOCATION_DEFINITION,
  [FieldKind.Array]: ARRAY_DEFINITION,
  [FieldKind.Object]: OBJECT_DEFINITION,
  [FieldKind.File]: FILE_DEFINITION,
  [FieldKind.Richtext]: RICHTEXT_DEFINITION,
  [FieldKind.Json]: JSON_DEFINITION,
  [FieldKind.Color]: COLOR_DEFINITION
};

const SYNONYM_MAP: Record<string, FieldKind> = Object.values(FIELD_REGISTRY).reduce(
  (acc, def) => {
    if (!def) return acc;
    acc[def.display.label.toLowerCase()] = def.kind;
    return acc;
  },
  {} as Record<string, FieldKind>
);
