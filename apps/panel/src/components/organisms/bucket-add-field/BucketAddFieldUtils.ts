// Utility: configuration default value derivation (property construction handled by domain facade)

const DEFAULT_VALUES = {
  string: "",
  textarea: "",
  boolean: false,
  multiselect: [],
  select: "",
  chip: [],
  bucket: ""
};

export const getDefaultValues = (
  schema: Record<string, {type: string}>,
  extraDefaults: Record<string, any> = {}
) => ({
  ...extraDefaults,
  ...Object.fromEntries(
    Object.keys(schema).map(key => [
      key,
      DEFAULT_VALUES[schema[key].type as keyof typeof DEFAULT_VALUES]
    ])
  )
});
