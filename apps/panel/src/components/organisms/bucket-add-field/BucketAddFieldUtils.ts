import type {TypeInputType} from "oziko-ui-kit";
import type {Property} from "src/services/bucketService";

const createArrayConfig = (
  baseProperty: Record<string, any>,
  fieldValues: Record<string, any>,
  arrayDefaultValues: Record<string, any>
) => {
  const config = {
    ...baseProperty,
    maxItems: fieldValues.arrayType === "multiselect" ? undefined : fieldValues.maxItems,
    minItems: fieldValues.minItems || undefined,
    uniqueItems: fieldValues.uniqueItems || undefined,
    items: {
      type: fieldValues.arrayType,
      title: fieldValues.arrayItemTitle,
      description: fieldValues.arrayItemDescription,
      default: arrayDefaultValues[fieldValues.arrayType] ?? undefined
    }
  } as unknown as Property;

  if (fieldValues.arrayType === "multiselect") {
    config.items.items = {
      type: fieldValues.multipleSelectionType,
      enum: fieldValues.chip || undefined
    };
    config.items.maxItems = fieldValues.maxItems;
  }

  if (fieldValues.innerFields) {
    config.items.properties = fieldValues.innerFields.reduce(
      (
        acc: Property,
        field: {
          type: TypeInputType;
          fieldValues: Record<string, any>;
          configurationValues: Record<string, any>;
        }
      ) => {
        acc[field.fieldValues.title] = createFieldProperty(
          field.type,
          field.fieldValues,
          field.configurationValues
        );
        return acc;
      },
      {}
    );
  }

  if (fieldValues.enumeratedValues?.length > 0) {
    config.items.enum = fieldValues.enumeratedValues;
  }

  if (fieldValues.regularExpression?.length) {
    config.items.pattern = fieldValues.regularExpression;
  }

  if (fieldValues.maxNumber != null) {
    config.items.maximum = fieldValues.maxNumber;
  }

  if (fieldValues.minNumber != null) {
    config.items.minimum = fieldValues.minNumber;
  }

  return config;
};

export const createFieldProperty = (
  type: TypeInputType,
  fieldValues: Record<string, any>,
  configurationValue: Record<string, any>
): Property => {
  const baseProperty = {
    type,
    title: fieldValues.title,
    description: fieldValues.description,
    options: {
      position: "bottom",
      index: configurationValue.index || undefined,
      unique: configurationValue.uniqueValues || undefined,
      translate: configurationValue.translate || undefined
    },
    readOnly: configurationValue.readOnly || undefined,
    default: fieldValues.default?.length ? fieldValues.default : undefined,
    pattern: fieldValues.regularExpression?.length ? fieldValues.regularExpression : undefined
  } as Property;

  const arrayDefaultValues = {
    string: fieldValues.defaultString,
    number: fieldValues.defaultNumber,
    boolean: fieldValues.defaultBoolean
  };

  switch (type) {
    case "string":
      return {
        ...baseProperty,
        enum:
          (fieldValues.enumeratedValues as string[])?.length > 0
            ? (fieldValues.enumeratedValues as string[])
            : undefined
      };

    case "number":
      return {
        ...baseProperty,
        minimum: fieldValues.minimum,
        maximum: fieldValues.maximum,
        enum:
          (configurationValue.enumeratedValues as string[])?.length > 0
            ? (configurationValue.enumeratedValues as string[])
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
      return createArrayConfig(baseProperty, fieldValues, arrayDefaultValues);

    case "boolean":
      return {
        ...baseProperty,
        default: fieldValues.default
      };

    case "location":
    case "object":
    case "storage":
    case "richtext":
    case "date":
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
  chip: []
};

export const getDefaultValues = (
  schema: Record<string, {type: string}>,
  initial?: Record<string, any>,
  extraDefaults: Record<string, any> = {}
) =>
  initial ?? {
    ...extraDefaults,
    ...Object.fromEntries(
      Object.keys(schema).map(key => [
        key,
        DEFAULT_VALUES[schema[key].type as keyof typeof DEFAULT_VALUES]
      ])
    )
  };


export const makeTab = (label: string, onClick: () => void) => ({
  prefix: {children: label, onClick}
});
