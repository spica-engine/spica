import type {Property} from "src/services/bucketService";
import type {FormValues} from "./BucketAddFieldBusiness";

const createArrayConfig = (baseProperty: Record<string, any>, values: FormValues) => {
  const arrayDefaultValues = {
    string: values.defaultValue.defaultString?.length
      ? values.defaultValue.defaultString
      : undefined,
    number: values.defaultValue.defaultNumber,
    boolean: values.defaultValue.defaultBoolean
  };

  const config = {
    ...baseProperty,
    maxItems:
      values.fieldValues.arrayType === "multiselect" ? undefined : values.fieldValues.maxItems,
    minItems: values.fieldValues.minItems || undefined,
    uniqueItems: values.fieldValues.uniqueItems || undefined,
    items: {
      type: values.fieldValues.arrayType,
      title: values.fieldValues.arrayItemTitle,
      description: values.fieldValues.arrayItemDescription?.length
        ? values.fieldValues.arrayItemDescription
        : undefined,
      default:
        arrayDefaultValues[values.fieldValues.arrayType as keyof typeof arrayDefaultValues] ??
        undefined
    }
  } as unknown as Property;

  if (values.fieldValues.arrayType === "multiselect") {
    config.items.items = {
      type: values.fieldValues.multipleSelectionType,
      enum: values.fieldValues.chip?.length > 0 ? values.fieldValues.chip : undefined
    };
    config.items.maxItems = values.fieldValues.maxItems;
  }

  if (values.innerFields) {
    config.items.properties = values.innerFields.reduce<Property>(
      (acc: Property, field: FormValues) => {
        acc[field.fieldValues.title] = createFieldProperty(field);
        return acc;
      },
      {} as Property
    );
  }

  if (values.presetValues.enumeratedValues?.length > 0) {
    config.items.enum = values.presetValues.enumeratedValues;
  }

  if (values.presetValues.regularExpression?.length) {
    config.items.pattern = values.presetValues.regularExpression;
  }

  if (values.fieldValues.maxNumber != null) {
    config.items.maximum = values.fieldValues.maxNumber;
  }

  if (values.fieldValues.minNumber != null) {
    config.items.minimum = values.fieldValues.minNumber;
  }

  return config;
};

export const createFieldProperty = (values: FormValues): Property => {
  const fieldValues = values.fieldValues;
  const configurationValues = values.configurationValues;
  const defaultValue = values.defaultValue.default;
  const type = values.type;
  const presetValues = values.presetValues;
  const baseProperty = {
    type,
    title: fieldValues.title,
    description: fieldValues.description,
    options: {
      position: "bottom",
      index: configurationValues.index || undefined,
      unique: configurationValues.uniqueValues || undefined,
      translate: configurationValues.translate || undefined
    },
    readOnly: configurationValues.readOnly || undefined,
    default: defaultValue,
    pattern:
      type !== "array" && presetValues.regularExpression?.length
        ? presetValues.regularExpression
        : undefined
  } as Property;

  switch (type) {
    case "string":
      return {
        ...baseProperty,
        default: defaultValue.length ? defaultValue : undefined,
        enum:
          (presetValues.enumeratedValues as string[])?.length > 0
            ? (presetValues.enumeratedValues as string[])
            : undefined
      };

    case "number":
      return {
        ...baseProperty,
        minimum: fieldValues.minimum,
        maximum: fieldValues.maximum,
        enum:
          (fieldValues.enumeratedValues as string[])?.length > 0
            ? (fieldValues.enumeratedValues as string[])
            : undefined
      };

    case "multiselect":
      return {
        ...baseProperty,
        items: {
          type: fieldValues.multipleSelectionType,
          enum: fieldValues.chip?.length > 0 ? fieldValues.chip : undefined
        },
        maxItems: fieldValues.maxItems
      };

    case "array":
      return createArrayConfig(baseProperty, values);

    case "date":
      return {
        ...baseProperty,
        default: defaultValue.length ? defaultValue : undefined
      };

    case "object":
      return {
        ...baseProperty,
        properties: values.innerFields?.reduce<Property>((acc: Property, field: FormValues) => {
          acc[field.fieldValues.title] = createFieldProperty(field);
          return acc;
        }, {} as Property)
      } as Property;

    case "boolean":
    case "location":
    case "storage":
    case "richtext":
    case "color":
    case "textarea":
      return baseProperty;
    case "relation":
      return {
        ...baseProperty,
        relationType: fieldValues.relationType,
        bucketId: fieldValues.bucket,
        dependent: fieldValues.dependent
      };
    default:
      return baseProperty;
  }
};

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
