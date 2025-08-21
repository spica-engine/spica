import type {TypeInputType} from "oziko-ui-kit";
import type {Property} from "src/services/bucketService";

export const createFieldProperty = (
  type: TypeInputType | "relation",
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
      return {
        ...baseProperty,
        pattern: undefined,
        maxItems: fieldValues.arrayType === "multiselect" ? undefined : fieldValues.maxItems,
        minItems: fieldValues.minItems,
        uniqueItems: fieldValues.uniqueItems || undefined,
        items: {
          items:
            fieldValues.arrayType === "multiselect"
              ? {
                  type: fieldValues.multipleSelectionType,
                  enum: fieldValues.chip || undefined
                }
              : undefined,
          maxItems: fieldValues.arrayType !== "multiselect" ? undefined : fieldValues.maxItems,
          type: fieldValues.arrayType,
          default:
            arrayDefaultValues[fieldValues.arrayType as "string" | "number" | "boolean"] ||
            (fieldValues.arrayType === "boolean" ? false : undefined),
          title: fieldValues.arrayItemTitle,
          description: fieldValues.arrayItemDescription,
          properties: fieldValues.innerFields
            ? fieldValues.innerFields.reduce(
                (
                  acc: Record<string, any>,
                  {
                    fieldValues,
                    configurationValues,
                    type
                  }: {
                    fieldValues: Record<string, any>;
                    configurationValues: Record<string, any>;
                    type: "relation" | TypeInputType;
                  }
                ) => {
                  acc[fieldValues.title] = createFieldProperty(
                    type,
                    fieldValues,
                    configurationValues
                  );
                  return acc;
                },
                {} as Record<string, any>
              )
            : undefined,
          enum:
            (fieldValues.enumeratedValues as string[])?.length > 0
              ? (fieldValues.enumeratedValues as string[])
              : undefined,
          pattern: fieldValues.regularExpression?.length
            ? fieldValues.regularExpression
            : undefined,
          maximum: fieldValues.maxNumber,
          minimum: fieldValues.minNumber
        }
      };

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
