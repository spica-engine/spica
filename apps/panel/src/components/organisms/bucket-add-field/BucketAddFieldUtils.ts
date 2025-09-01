import type {TypeInputType} from "oziko-ui-kit";
import type {Property} from "src/services/bucketService";
import type { FormValues } from "./BucketAddFieldBusiness";

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
        acc[field.values.title] = createFieldProperty(values.fieldValues);
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

export const createFieldProperty = (values: FormValues): Property => {
  const fieldValues = values.fieldValues
  const configurationValues = values.configurationValues
  const defaultValue = values.defaultValue.default
  const type = values.type
  const presetValues = values.presetValues
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
      type !== "array" && presetValues.regularExpression?.length ? presetValues.regularExpression : undefined
  } as Property;

  switch (type) {
    case "string":
      return {
        ...baseProperty,
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
          enum: fieldValues.chip
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
