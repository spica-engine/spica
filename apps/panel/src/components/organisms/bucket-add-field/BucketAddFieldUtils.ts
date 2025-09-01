import type {TypeInputType} from "oziko-ui-kit";
import type {Property} from "src/services/bucketService";

const createArrayConfig = (baseProperty: Record<string, any>, values: Record<string, any>) => {
  const arrayDefaultValues = {
    string: values.defaultString.length ? values.defaultString : undefined,
    number: values.defaultNumber,
    boolean: values.defaultBoolean
  };

  const config = {
    ...baseProperty,
    maxItems: values.arrayType === "multiselect" ? undefined : values.maxItems,
    minItems: values.minItems || undefined,
    uniqueItems: values.uniqueItems || undefined,
    items: {
      type: values.arrayType,
      title: values.arrayItemTitle,
      description: values.arrayItemDescription.length ? values.arrayItemDescription : undefined,
      default: arrayDefaultValues[values.arrayType as keyof typeof arrayDefaultValues] ?? undefined
    }
  } as unknown as Property;

  if (values.arrayType === "multiselect") {
    config.items.items = {
      type: values.multipleSelectionType,
      enum: values.chip || undefined
    };
    config.items.maxItems = values.maxItems;
  }

  if (values.innerFields) {
    config.items.properties = values.innerFields.reduce(
      (
        acc: Property,
        field: {
          type: TypeInputType;
          values: Record<string, any>;
          configurationValues: Record<string, any>;
        }
      ) => {
        acc[field.values.title] = createFieldProperty(field.type, field.values);
        return acc;
      },
      {}
    );
  }

  if (values.enumeratedValues?.length > 0) {
    config.items.enum = values.enumeratedValues;
  }

  if (values.regularExpression?.length) {
    config.items.pattern = values.regularExpression;
  }

  if (values.maxNumber != null) {
    config.items.maximum = values.maxNumber;
  }

  if (values.minNumber != null) {
    config.items.minimum = values.minNumber;
  }

  return config;
};

export const createFieldProperty = (type: TypeInputType, values: Record<string, any>): Property => {
  const baseProperty = {
    type,
    title: values.title,
    description: values.description,
    options: {
      position: "bottom",
      index: values.index || undefined,
      unique: values.uniqueValues || undefined,
      translate: values.translate || undefined
    },
    readOnly: values.readOnly || undefined,
    default: values.default,
    pattern:
      type !== "array" && values.regularExpression?.length ? values.regularExpression : undefined
  } as Property;

  switch (type) {
    case "string":
      return {
        ...baseProperty,
        enum:
          (values.enumeratedValues as string[])?.length > 0
            ? (values.enumeratedValues as string[])
            : undefined
      };

    case "number":
      return {
        ...baseProperty,
        minimum: values.minimum,
        maximum: values.maximum,
        enum:
          (values.enumeratedValues as string[])?.length > 0
            ? (values.enumeratedValues as string[])
            : undefined
      };

    case "multiselect":
      return {
        ...baseProperty,
        items: {
          type: values.multipleSelectionType,
          enum: values.chip
        },
        maxItems: values.maxItems
      };

    case "array":
      return createArrayConfig(baseProperty, values);

    case "date":
      return {
        ...baseProperty,
        default: values.default.length ? values.default : undefined
      };
    case "boolean":
    case "location":
    case "object":
    case "storage":
    case "richtext":
    case "color":
    case "textarea":
      return baseProperty;
    case "relation":
      return {
        ...baseProperty,
        relationType: values.relationType,
        bucketId: values.bucket,
        dependent: values.dependent
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
  bucket: "",
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
