const schema = {
  title: {
    type: "string",
    title: "Name"
  },
  description: {
    type: "textarea",
    title: "Description"
  },
  defaultString: {
    type: "string",
    title: "Default Value"
  },
  defaultNumber: {
    type: "number",
    title: "Default Value"
  },
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
  presets: {
    type: "multiselect",
    title: "Presets",
    enum: ["Countries", "Days", "Email", "Phone Number"]
  },
  makeEnumerated: {
    type: "boolean",
    title: "Make field enumerated"
  },
  enumeratedValues: {
    type: "chip",
    title: "EnumeratedValues"
  },
  definePattern: {
    type: "boolean",
    title: "Define Pattern"
  },
  regularExpression: {
    type: "string",
    title: "Regex"
  },
  primaryField: {
    type: "boolean",
    title: "Primary Field"
  },
  translatable: {
    type: "boolean",
    title: "Translatable"
  },
  readonly: {
    type: "boolean",
    title: "Readonly"
  },
  uniqueValues: {
    type: "boolean",
    title: "Unique Values"
  },
  uniqueItems: {
    type: "boolean",
    title: "Items should be unique"
  },
  requiredField: {
    type: "boolean",
    title: "Required Field"
  },
  selectionOptions: {
    type: "boolean",
    title: "Add selection options"
  },
  index: {
    type: "boolean",
    title: "Indexed field in database"
  },
  defaultBoolean: {
    type: "boolean",
    title: "Default value"
  },
  defaultDate: {
    type: "string",
    title: "Default Date",
    enum: ["None", "Created_at", "Updated_at"]
  },
  multipleSelectionType: {
    type: "string",
    title: "Type",
    enum: ["string", "number"]
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
    ]
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
  buckets: {
    title: "Buckets",
    type: "select",
    enum: []
  },
  relationType: {
    title: "Relation Type",
    type: "select",
    enum: ["One To One", "One To Many"]
  },
  dependent: {
    type: "boolean",
    title: "Dependent"
  }
};

const {
  title,
  description,
  defaultString,
  defaultNumber,
  minNumber,
  maxNumber,
  minItems,
  maxItems,
  presets,
  makeEnumerated,
  enumeratedValues,
  definePattern,
  regularExpression,
  primaryField,
  translatable,
  readonly,
  uniqueValues,
  uniqueItems,
  requiredField,
  selectionOptions,
  index,
  defaultBoolean,
  defaultDate,
  multipleSelectionType,
  arrayType,
  arrayItemTitle,
  arrayItemDescription,
  chip,
  buckets,
  relationType,
  dependent
} = schema;

export const createShema: any = {
  string: {
    title,
    description,
    default: defaultString,
    presets,
    makeEnumerated,
    enumeratedValues: {...enumeratedValues, requires: {field: "makeEnumerated", toBe: true}},
    definePattern,
    regularExpression: {...regularExpression, requires: {field: "definePattern", toBe: true}}
  },
  number: {
    title,
    description,
    default: defaultNumber,
    minimum: minNumber,
    maximum: maxNumber
  },
  date: {title, description, default: defaultDate},
  boolean: {title, description, default: defaultBoolean},
  textarea: {title, description},
  array: {
    title,
    description,
    arrayType,
    arrayItemTitle,
    arrayItemDescription,
    defaultString: {...defaultString, requires: {field: "arrayType", toBe: "string"}},
    defaultBoolean: {...defaultBoolean, requires: {field: "arrayType", toBe: "boolean"}},
    minNumber: {...minNumber, requires: {field: "arrayType", toBe: "number"}},
    maxNumber: {...maxNumber, requires: {field: "arrayType", toBe: "number"}},
    presets: {...presets, requires: {field: "arrayType", toBe: "string"}},
    makeEnumerated: {...makeEnumerated, requires: {field: "arrayType", toBe: ["string", "number"]}},
    enumeratedValues: {...enumeratedValues, requires: {field: "makeEnumerated", toBe: true}},
    definePattern: {...definePattern, requires: {field: "arrayType", toBe: "string"}},
    regularExpression: {...regularExpression, requires: {field: "definePattern", toBe: true}},
    uniqueItems: {
      ...uniqueItems,
      requires: {field: "arrayType", notToBe: ["boolean", "multiselect", "location", "object"]}
    },
    multipleSelectionType: {
      ...multipleSelectionType,
      requires: {field: "arrayType", toBe: "multiselect"}
    },
    minItems: {
      ...minItems,
      requires: {field: "arrayType", notToBe: ["multiselect", "location", "object"]}
    },
    maxItems: {...maxItems, requires: {field: "arrayType", notToBe: ["location", "object"]}},
    chip: {...chip, requires: {field: "arrayType", toBe: "multiselect"}}
  },
  multiselect: {title, description, multipleSelectionType, maxItems: maxNumber, chip},
  object: {title, description},
  color: {title, description},
  storage: {title, description},
  relation: {title, description, buckets, relationType, dependent},
  richtext: {title, description},
  location: {title, description},
  stringConfiguration: {
    primaryField,
    translate: translatable,
    readonly,
    uniqueValues,
    requiredField,
    index
  },
  numberConfiguration: {
    makeEnumerated,
    enumeratedValues: {...enumeratedValues, requires: {field: "makeEnumerated", toBe: true}},
    primaryField,
    readonly,
    uniqueValues,
    requiredField,
    index
  },
  configuration: {
    definePattern,
    primaryField,
    translate: translatable,
    readonly,
    uniqueValues,
    requiredField,
    selectionOptions,
    index
  }, // Used in string, number
  configurationType1: {
    readonly,
    requiredField,
    index
  }, // Used in date,color,multipleSelection,relation
  configurationType2: {
    translate: translatable,
    requiredField,
    readonly,
    index
  }, // Used in object,storage,richText
  configurationTextarea: {
    primaryField,
    translate: translatable,
    readonly,
    uniqueValues,
    requiredField,
    index
  },
  configurationBoolean: {
    primaryField,
    readonly,
    index
  },
  configurationLocation: {
    readonly,
    requiredField
  },
  configurationArray: {
    translate: translatable,
    readonly,
    requiredField,
    index
  }
};

export const configurationMapping = {
  string: createShema.stringConfiguration,
  number: createShema.numberConfiguration,
  date: createShema.configurationType1,
  color: createShema.configurationType1,
  multiselect: createShema.configurationType1,
  object: createShema.configurationType2,
  storage: createShema.configurationType2,
  richtext: createShema.configurationType2,
  textarea: createShema.configurationTextarea,
  boolean: createShema.configurationBoolean,
  location: createShema.configurationLocation,
  array: createShema.configurationArray,
  relation: createShema.configurationType1
};
