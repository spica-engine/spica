import type { TypeInputType } from "oziko-ui-kit";
import type { Property } from "src/services/bucketService";


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
      index: configurationValue.index
    }
  } as Property;

  switch (type) {
    case "string":
      return {
        ...baseProperty,
        options: {...baseProperty.options, translate: configurationValue.translate},
        pattern: fieldValues.regularExpression,
        enum:
          (fieldValues.enumeratedValues as string[])?.length > 0
            ? (fieldValues.enumeratedValues as string[])
            : undefined,
        default: fieldValues.default
      };

    case "number":
      return {
        ...baseProperty,
        minimum: fieldValues.minimum,
        maximum: fieldValues.maximum,
        enum:
          (configurationValue.enumeratedValues as string[])?.length > 0
            ? (configurationValue.enumeratedValues as string[])
            : undefined,
        default: fieldValues.default
      };

    case "date":
    case "boolean":
      return {
        ...baseProperty,
        readOnly: configurationValue.readOnly,
        default: fieldValues.default
      };

    case "color":
      return {
        ...baseProperty,
        readOnly: configurationValue.readOnly
      };

    case "textarea":
      return {
        ...baseProperty,
        options: {...baseProperty.options, translate: configurationValue.translate},
        readOnly: configurationValue.readOnly,
        default: fieldValues.default
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

    case "location":
      return {
        ...baseProperty,
        locationType: "Point",
        readOnly: configurationValue.readOnly
      };

    case "array":
      return {
        ...baseProperty,
        options: {...baseProperty.options, translate: configurationValue.translate},
        pattern: fieldValues.regularExpression,
        enum:
          (fieldValues.enumeratedValues as string[])?.length > 0
            ? (fieldValues.enumeratedValues as string[])
            : undefined,
        default: fieldValues.default,
        maxItems: fieldValues.maxItems,
        minItems: fieldValues.minItems,
        uniqueItems: fieldValues.uniqueItems,
        items: {
          type: fieldValues.arrayType,
          title: fieldValues.arrayItemTitle,
          description: fieldValues.arrayItemDescription,
          properties: fieldValues.innerFields?.map((field: Property) =>
            createFieldProperty(field.type, field, {})
          )
        }
      };

    case "object":
    case "storage":
    case "richtext":
      return {
        ...baseProperty,
        options: {...baseProperty.options, translate: configurationValue.translate},
        readOnly: configurationValue.readOnly
      };
    case "relation":
      return baseProperty;
    default:
      return baseProperty;
  }
};
