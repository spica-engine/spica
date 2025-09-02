import type {TypeInputType} from "oziko-ui-kit";

// Base schema definitions
const baseFields = {
  title: {
    type: "string",
    title: "Name",
    required: true
  },
  description: {
    type: "textarea",
    title: "Description"
  }
};

// Default value fields
const defaultValueFields = {
  defaultString: {
    type: "string",
    title: "Default Value"
  },
  defaultNumber: {
    type: "number",
    title: "Default Value"
  },
  defaultBoolean: {
    type: "boolean",
    title: "Default value",
    size: "small"
  },
  defaultDate: {
    type: "string",
    title: "Default Date",
    enum: [
      {label: "None", value: ""},
      {label: "Created At", value: ":created_at"},
      {label: "Updated At", value: ":updated_at"}
    ]
  }
};

export const defaultConfig = {
  string: {default: defaultValueFields.defaultString},
  number: {default: defaultValueFields.defaultNumber},
  boolean: {default: defaultValueFields.defaultBoolean},
  date: {default: defaultValueFields.defaultDate}
};

// Validation fields
const validationFields = {
  minNumber: {
    type: "number",
    title: "Minimum"
  },
  maxNumber: {
    type: "number",
    title: "Maximum"
  },
  minItems: {
    type: "number",
    title: "Min Items"
  },
  maxItems: {
    type: "number",
    title: "Max Items"
  },
  definePattern: {
    type: "boolean",
    title: "Define Pattern",
    size: "small"
  },
  regularExpression: {
    type: "string",
    title: "Regex"
  }
};

// Specialized fields
const specializedFields = {
  preset: {
    type: "string",
    title: "Presets",
    enum: ["Countries", "Days", "Email", "Phone Number"]
  },
  makeEnumerated: {
    type: "boolean",
    title: "Make field enumerated",
    size: "small"
  },
  enumeratedValues: {
    type: "chip",
    title: "EnumeratedValues"
  },
  multipleSelectionType: {
    type: "string",
    title: "Type",
    enum: ["string", "number"],
    required: true
  },
  arrayType: {
    type: "string",
    title: "Array Type",
    enum: [
      "string",
      "date",
      "number",
      "textarea",
      "boolean",
      "color",
      "storage",
      "multiselect",
      "location",
      "richtext",
      "object"
    ],
    required: true
  },
  arrayItemTitle: {
    type: "string",
    title: "Title"
  },
  arrayItemDescription: {
    type: "string",
    title: "Description"
  },
  chip: {
    type: "chip",
    title: ""
  },
  bucket: {
    title: "Buckets",
    type: "select",
    enum: []
  },
  relationType: {
    title: "Relation Type",
    type: "select",
    enum: [
      {label: "One To One", value: "onetoone"},
      {label: "One To Many", value: "onetomany"}
    ]
  },
  dependent: {
    type: "boolean",
    title: "Dependent",
    size: "small"
  },
  uniqueItems: {
    type: "boolean",
    title: "Items should be unique",
    size: "small"
  }
};

// Combine all schema fields
const schema = {
  ...baseFields,
  ...defaultValueFields,
  ...validationFields,
  ...specializedFields
};

// Create schemas for different field types
export const createShema = {
  string: baseFields,
  number: {
    ...baseFields,
    minimum: schema.minNumber,
    maximum: schema.maxNumber,
    makeEnumerated: schema.makeEnumerated,
    enumeratedValues: {
      ...schema.enumeratedValues,
      valueType: "number",
      renderCondition: {field: "makeEnumerated", equals: true}
    }
  },
  date: baseFields,
  boolean: baseFields,
  textarea: baseFields,
  array: {
    ...baseFields,
    arrayType: schema.arrayType,
    arrayItemTitle: schema.arrayItemTitle,
    arrayItemDescription: schema.arrayItemDescription,
    defaultString: {
      ...schema.defaultString,
      renderCondition: {field: "arrayType", equals: "string"}
    },
    defaultBoolean: {
      ...schema.defaultBoolean,
      renderCondition: {field: "arrayType", equals: "boolean"}
    },
    defaultNumber: {
      ...schema.defaultNumber,
      renderCondition: {field: "arrayType", equals: "number"}
    },
    minNumber: {...schema.minNumber, renderCondition: {field: "arrayType", equals: "number"}},
    maxNumber: {...schema.maxNumber, renderCondition: {field: "arrayType", equals: "number"}},
    makeEnumerated: {
      ...schema.makeEnumerated,
      renderCondition: {field: "arrayType", equals: "number"}
    },
    enumeratedValues: {
      ...schema.enumeratedValues,
      valueType: "number",
      renderCondition: {field: "makeEnumerated", equals: true}
    },
    regularExpression: {
      ...schema.regularExpression,
      renderCondition: {field: "definePattern", equals: true}
    },
    uniqueItems: {
      ...schema.uniqueItems,
      renderCondition: {
        field: "arrayType",
        notEquals: ["multiselect", "location", "object", "boolean"]
      }
    },
    multipleSelectionType: {
      ...schema.multipleSelectionType,
      renderCondition: {field: "arrayType", equals: "multiselect"}
    },
    minItems: {
      ...schema.minItems,
      renderCondition: {field: "arrayType", notEquals: ["multiselect", "location", "object"]}
    },
    maxItems: {
      ...schema.maxItems,
      renderCondition: {field: "arrayType", notEquals: ["location", "object"]}
    },
    chip: {...schema.chip, renderCondition: {field: "arrayType", equals: "multiselect"}}
  },
  multiselect: {
    ...baseFields,
    multipleSelectionType: schema.multipleSelectionType,
    maxItems: schema.maxItems,
    chip: schema.chip
  },
  object: baseFields,
  color: baseFields,
  storage: baseFields,
  relation: {
    ...baseFields,
    bucket: {...schema.bucket, required: true},
    relationType: {...schema.relationType, required: true},
    dependent: schema.dependent
  },
  richtext: baseFields,
  location: baseFields
} as unknown as Record<TypeInputType, Record<string, any>>;

export const presetProperties = {
  preset: schema.preset,
  makeEnumerated: schema.makeEnumerated,
  enumeratedValues: {
    ...schema.enumeratedValues,
    renderCondition: {field: "makeEnumerated", equals: true}
  },
  definePattern: schema.definePattern,
  regularExpression: {
    ...schema.regularExpression,
    renderCondition: {field: "definePattern", equals: true}
  }
};

// Configuration field definitions
const configFieldDefinitions = {
  primaryField: {
    type: "boolean",
    title: "Primary Field",
    size: "small"
  },
  translate: {
    type: "boolean",
    title: "Translatable",
    size: "small"
  },
  uniqueValues: {
    type: "boolean",
    title: "Unique Values",
    size: "small"
  },
  requiredField: {
    type: "boolean",
    title: "Required Field",
    size: "small"
  },
  index: {
    type: "boolean",
    title: "Indexed field in database",
    size: "small"
  }
} as const;

// Reusable configuration field sets
const basicConfigFields = {
  primaryField: configFieldDefinitions.primaryField,
  uniqueValues: configFieldDefinitions.uniqueValues,
  requiredField: configFieldDefinitions.requiredField,
  index: configFieldDefinitions.index
};

const translatableConfigFields = {
  ...basicConfigFields,
  translate: configFieldDefinitions.translate
};

const minimalConfigFields = {
  requiredField: configFieldDefinitions.requiredField,
  index: configFieldDefinitions.index
};

const onlyRequiredField = {
  requiredField: configFieldDefinitions.requiredField
};

const primaryAndIndexFields = {
  primaryField: configFieldDefinitions.primaryField,
  index: configFieldDefinitions.index
};

const translatableMinimalFields = {
  translate: configFieldDefinitions.translate,
  requiredField: configFieldDefinitions.requiredField,
  index: configFieldDefinitions.index
};

export const configPropertiesMapping = {
  // Full translatable support
  string: translatableConfigFields,
  textarea: translatableConfigFields,
  object: translatableConfigFields,
  select: translatableConfigFields,

  // Translatable with minimal options
  richtext: translatableMinimalFields,
  array: translatableMinimalFields,
  storage: translatableMinimalFields,

  // Basic configuration
  number: basicConfigFields,
  color: basicConfigFields,
  chip: basicConfigFields,

  // Minimal configuration
  date: minimalConfigFields,
  multiselect: minimalConfigFields,
  relation: minimalConfigFields,

  // Special cases
  boolean: primaryAndIndexFields,
  location: onlyRequiredField
};

export const innerFieldConfigProperties = {
  // Standard inner fields
  string: minimalConfigFields,
  number: minimalConfigFields,
  date: minimalConfigFields,
  textarea: minimalConfigFields,
  array: minimalConfigFields,
  multiselect: minimalConfigFields,
  object: minimalConfigFields,
  color: minimalConfigFields,
  storage: minimalConfigFields,
  relation: minimalConfigFields,
  richtext: minimalConfigFields,

  // Special inner fields
  location: {requiredField: configFieldDefinitions.requiredField},
  boolean: {index: configFieldDefinitions.index}
};
