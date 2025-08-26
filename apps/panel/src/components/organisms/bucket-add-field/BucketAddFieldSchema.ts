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
    size: "small",
  },
  defaultDate: {
    type: "string",
    title: "Default Date",
    enum: ["None", ":created_at", ":updated_at"]
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
    size: "small",
  },
  regularExpression: {
    type: "string",
    title: "Regex"
  }
};

// Configuration fields
export const configFields = {
  primaryField: {
    type: "boolean",
    title: "Primary Field",
    size: "small",
  },
  translatable: {
    type: "boolean",
    title: "Translatable",
    size: "small",
  },
  //readOnly: {
  //  type: "boolean",
  //  title: "Readonly"
  //},
  uniqueValues: {
    type: "boolean",
    title: "Unique Values",
    size: "small"
  },
  requiredField: {
    type: "boolean",
    title: "Required Field",
    size: "small",
  },
  index: {
    type: "boolean",
    title: "Indexed field in database",
    size: "small",
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
    size: "small",
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
    size: "small",
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
  ...configFields,
  ...specializedFields
};

// Create schemas for different field types
export const createShema = {
  string: baseFields,
  number: {
    ...baseFields,
    minimum: schema.minNumber,
    maximum: schema.maxNumber
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
    presets: {...schema.preset, renderCondition: {field: "arrayType", equals: "string"}},
    makeEnumerated: {
      ...schema.makeEnumerated,
      renderCondition: {field: "arrayType", equals: ["string", "number"]}
    },
    enumeratedValues: {
      ...schema.enumeratedValues,
      renderCondition: {field: "makeEnumerated", equals: true}
    },
    definePattern: {
      ...schema.definePattern,
      renderCondition: {field: "arrayType", equals: "string"}
    },
    regularExpression: {
      ...schema.regularExpression,
      renderCondition: {field: "definePattern", equals: true}
    },
    uniqueItems: {
      ...schema.uniqueItems,
      renderCondition: {field: "arrayType", notEquals: ["multiselect", "location", "object"]}
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
    bucket: schema.bucket,
    relationType: schema.relationType,
    dependent: schema.dependent
  },
  richtext: baseFields,
  location: baseFields
} as unknown as Record<TypeInputType, Record<string, any>>;

export const presetPropertiesMapping = {
  string: {
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
  }
};
