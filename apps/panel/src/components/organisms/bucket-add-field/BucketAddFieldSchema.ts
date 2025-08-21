import type {TypeInputType} from "oziko-ui-kit";

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
  readOnly: {
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
    enum: ["None", ":created_at", ":updated_at"]
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
  readOnly,
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
  bucket,
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
    enumeratedValues: {
      ...enumeratedValues,
      renderCondition: {field: "makeEnumerated", equals: true}
    },
    definePattern,
    regularExpression: {
      ...regularExpression,
      renderCondition: {field: "definePattern", equals: true}
    }
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
    defaultString: {...defaultString, renderCondition: {field: "arrayType", equals: "string"}},
    defaultBoolean: {...defaultBoolean, renderCondition: {field: "arrayType", equals: "boolean"}},
    defaultNumber: {...defaultNumber, renderCondition: {field: "arrayType", equals: "number"}},
    minNumber: {...minNumber, renderCondition: {field: "arrayType", equals: "number"}},
    maxNumber: {...maxNumber, renderCondition: {field: "arrayType", equals: "number"}},
    presets: {...presets, renderCondition: {field: "arrayType", equals: "string"}},
    makeEnumerated: {
      ...makeEnumerated,
      renderCondition: {field: "arrayType", equals: ["string", "number"]}
    },
    enumeratedValues: {
      ...enumeratedValues,
      renderCondition: {field: "makeEnumerated", equals: true}
    },
    definePattern: {...definePattern, renderCondition: {field: "arrayType", equals: "string"}},
    regularExpression: {
      ...regularExpression,
      renderCondition: {field: "definePattern", equals: true}
    },
    uniqueItems: {
      ...uniqueItems,
      renderCondition: {field: "arrayType", notEquals: ["multiselect", "location", "object"]}
    },
    multipleSelectionType: {
      ...multipleSelectionType,
      renderCondition: {field: "arrayType", equals: "multiselect"}
    },
    minItems: {
      ...minItems,
      renderCondition: {field: "arrayType", notEquals: ["multiselect", "location", "object"]}
    },
    maxItems: {
      ...maxItems,
      renderCondition: {field: "arrayType", notEquals: ["location", "object"]}
    },
    chip: {...chip, renderCondition: {field: "arrayType", equals: "multiselect"}}
  },
  multiselect: {title, description, multipleSelectionType, maxItems, chip},
  object: {title, description},
  color: {title, description},
  storage: {title, description},
  relation: {title, description, bucket, relationType, dependent},
  richtext: {title, description},
  location: {title, description},
  stringConfiguration: {
    primaryField,
    translate: translatable,
    readOnly,
    uniqueValues,
    requiredField,
    index
  },
  numberConfiguration: {
    makeEnumerated,
    enumeratedValues: {
      ...enumeratedValues,
      renderCondition: {field: "makeEnumerated", equals: true}
    },
    primaryField,
    readOnly,
    uniqueValues,
    requiredField,
    index
  },
  innerConfiguration: {
    requiredField,
    index
  }, // Used in inner fields, string, number, date, textarea, multiselect, relation, object, storage, richtext, array, color
  innerConfiguration2: {
    index
  }, // Used in inner fields, boolean, location,
  configurationType1: {
    readOnly,
    requiredField,
    index
  }, // Used in date,color,multipleSelection,relation
  configurationType2: {
    translate: translatable,
    requiredField,
    readOnly,
    index
  }, // Used in object,storage,richText
  configurationTextarea: {
    primaryField,
    translate: translatable,
    readOnly,
    uniqueValues,
    requiredField,
    index
  },
  configurationBoolean: {
    primaryField,
    readOnly,
    index
  },
  configurationLocation: {
    readOnly,
    requiredField
  },
  configurationArray: {
    translate: translatable,
    readOnly,
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

export const innerConfigurationMapping: Record<TypeInputType, Record<string, any>> = {
  string: createShema.innerConfiguration,
  number: createShema.innerConfiguration,
  color: createShema.innerConfiguration,
  date: createShema.innerConfiguration,
  textarea: createShema.innerConfiguration,
  multiselect: createShema.innerConfiguration,
  relation: createShema.innerConfiguration,
  object: createShema.innerConfiguration,
  storage: createShema.innerConfiguration,
  richtext: createShema.innerConfiguration,
  array: createShema.innerConfiguration,
  boolean: createShema.innerConfiguration2,
  location: createShema.innerConfiguration2
};
