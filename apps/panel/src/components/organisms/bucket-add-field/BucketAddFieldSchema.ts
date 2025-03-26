const schema = {
  title: {
    type: "string",
    title: "",
  },
  description: {
    type: "textarea",
    title: "Description",
  },
  defaultString: {
    type: "string",
    title: "Default Value",
  },
  defaultNumber: {
    type: "number",
    title: "Default Value",
  },
  minNumber: {
    type: "number",
    title: "Minimum",
  },
  maxNumber: {
    type: "number",
    title: "Maximum",
  },
  presets: {
    type: "multiselect",
    title: "Presets",
    enum: ["Countries", "Days", "Email", "Phone Number"],
  },
  definePattern: {
    type: "boolean",
    title: "Define Pattern",
  },
  primaryField: {
    type: "boolean",
    title: "Primary Field",
  },
  translatable: {
    type: "boolean",
    title: "Translatable",
  },
  readonly: {
    type: "boolean",
    title: "Readonly",
  },
  uniqueValues: {
    type: "boolean",
    title: "Unique Values",
  },
  requiredField: {
    type: "boolean",
    title: "Required Field",
  },
  selectionOptions: {
    type: "boolean",
    title: "Add selection options",
  },
  index: {
    type: "boolean",
    title: "Indexed field in database",
  },
  defaultBoolean: {
    type: "boolean",
    title: "Default value",
  },
  defaultDate: {
    type: "string",
    title: "Default Date",
    enum: ["None", "Created_at", "Updated_at"],
  },
  multipleSelectionType: {
    type: "string",
    title: "Type",
    enum: ["string", "number"],
  },
  arrayType: {
    type: "string",
    title: "",
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
      "object",
    ],
  },
  arrayItemTitle: {
    type: "string",
    title: "Title",
  },
  chip: {
    type: "chip",
    title: "",
  },
};

const {
  title,
  description,
  defaultString,
  defaultNumber,
  minNumber,
  maxNumber,
  presets,
  definePattern,
  primaryField,
  translatable,
  readonly,
  uniqueValues,
  requiredField,
  selectionOptions,
  index,
  defaultBoolean,
  defaultDate,
  multipleSelectionType,
  arrayType,
  chip,
} = schema;

export const createShema: any = {
  string: { title, description, defaultString, presets },
  number: { title, description, defaultNumber, minNumber, maxNumber, presets },
  date: { title, description, defaultDate },
  boolean: { title, description, defaultBoolean },
  textarea: { title, description },
  array: { title, description, arrayType, defaultString, presets, minNumber, maxNumber },
  multiselect: { title, description, multipleSelectionType, maxNumber, chip },
  object: { title, description },
  color: { title, description },
  storage: { title, description },
  //Todo Add Relation field
  richtext: { title, description },
  location: { title, description },
  configuration: {
    definePattern,
    primaryField,
    translatable,
    readonly,
    uniqueValues,
    requiredField,
    selectionOptions,
    index,
  }, // Used in string, number
  configurationType1: {
    readonly,
    requiredField,
    index,
  }, // Used in date,color,multipleSelection
  configurationType2: {
    translatable,
    primaryField,
    readonly,
    index,
  }, // Used in object,storage,richText
  configurationTextarea: {
    primaryField,
    translatable,
    readonly,
    uniqueValues,
    requiredField,
    index,
  },
  configurationBoolean: {
    primaryField,
    readonly,
    index,
  },
  configurationLocation: {
    readonly,
    requiredField,
  },
  configurationArray: {
    translatable,
    readonly,
    requiredField,
    index,
  },
};
