
export const BaseFields = {
  title: {type: "string", title: "Name", required: true},
  description: {
    type: "textarea",
    title: "Textarea title",
    icon: "sort",
    placeholder: "Description of the input"
  }
} as const;

export const DefaultInputs = {
  defaultString: {type: "string", title: "Default Value"},
  defaultNumber: {type: "number", title: "Default Value"},
  defaultBoolean: {type: "boolean", title: "Default value", size: "extra-small"},
  defaultDate: {
    type: "string",
    title: "Default Date",
    enum: [
      {label: "No Default", value: ""},
      {label: "Created At", value: ":created_at"},
      {label: "Updated At", value: ":updated_at"},
    ]
  }
} as const;

export const ValidationInputs = {
  minNumber: {type: "number", title: "Minimum"},
  maxNumber: {type: "number", title: "Maximum"},
  minItems: {type: "number", title: "Min Items"},
  maxItems: {type: "number", title: "Max Items"},
  definePattern: {type: "boolean", title: "Define Pattern", size: "extra-small"},
  regularExpression: {type: "string", title: "Regex"}
} as const;

export const SpecializedInputs = {
  preset: {
    type: "string",
    title: "Presets",
    enum: ["Countries", "Days", "Email", "Phone Number"] as string[]
  },
  makeEnumerated: {type: "boolean", title: "Make field enumerated", size: "extra-small"},
  enumeratedValues: {type: "chip", title: "EnumeratedValues"},
  multipleSelectionType: {
    type: "string",
    title: "Type",
    enum: ["string", "number"] as string[],
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
    ] as string[],
    required: true
  },
  arrayItemTitle: {type: "string", title: "Title"},
  arrayItemDescription: {type: "string", title: "Description"},
  chip: {type: "chip", title: ""},
  bucket: {title: "Buckets", type: "string", enum: []},
  relationType: {
    title: "Relation Type",
    type: "string",
    enum: [
      {label: "One To One", value: "onetoone"},
      {label: "One To Many", value: "onetomany"}
    ]
  },
  uniqueItems: {type: "boolean", title: "Items should be unique", size: "extra-small"}
} as const;

export const PresetPanel = {
  preset: SpecializedInputs.preset,
  makeEnumerated: SpecializedInputs.makeEnumerated,
  enumeratedValues: {
    ...SpecializedInputs.enumeratedValues,
    renderCondition: {field: "makeEnumerated", equals: true},
  },
  definePattern: ValidationInputs.definePattern,
  regularExpression: {
    ...ValidationInputs.regularExpression,
    renderCondition: {field: "definePattern", equals: true}
  }
} as const;

export const ConfigDefs = {
  primaryField: {type: "boolean", title: "Primary Field", size: "extra-small"},
  translate: {type: "boolean", title: "Translatable", size: "extra-small"},
  uniqueValues: {type: "boolean", title: "Unique Values", size: "extra-small"},
  requiredField: {type: "boolean", title: "Required Field", size: "extra-small"},
  index: {type: "boolean", title: "Indexed field in database", size: "extra-small"},
  dependent: {type: "boolean", title: "Dependent", size: "extra-small"}
} as const;

export const BasicConfig = {
  primaryField: ConfigDefs.primaryField,
  uniqueValues: ConfigDefs.uniqueValues,
  requiredField: ConfigDefs.requiredField,
  index: ConfigDefs.index
} as const;

export const TranslatableConfig = {
  ...BasicConfig,
  translate: ConfigDefs.translate
} as const;

export const MinimalConfig = {
  requiredField: ConfigDefs.requiredField,
  index: ConfigDefs.index
} as const;

export const OnlyRequiredConfig = {
  requiredField: ConfigDefs.requiredField
} as const;

export const PrimaryAndIndexConfig = {
  primaryField: ConfigDefs.primaryField,
  index: ConfigDefs.index
} as const;

export const TranslatableMinimalConfig = {
  translate: ConfigDefs.translate,
  requiredField: ConfigDefs.requiredField,
  index: ConfigDefs.index
} as const;

export const MinimalInnerFieldConfig = {
  index: ConfigDefs.index
} as const;

export const RelationFieldConfig = {
  dependent: ConfigDefs.dependent,
  ...MinimalConfig
} as const;
