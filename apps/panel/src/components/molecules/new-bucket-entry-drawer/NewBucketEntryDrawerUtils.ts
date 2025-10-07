import {FIELD_REGISTRY} from "../../../domain/fields";
import type {FieldDefinition} from "src/domain/fields/types";
import type {Properties, Property} from "src/services/bucketService";

type FormError = {[key: string]: string | FormError | undefined};

const isObjectEffectivelyEmpty = (obj: Record<string, any>): boolean => {
  if (obj == null || typeof obj !== "object") return true;

  return Object.keys(obj).every(
    key =>
      obj[key] === undefined ||
      obj[key] === null ||
      (typeof obj[key] === "object" && isObjectEffectivelyEmpty(obj[key]))
  );
};

const cleanValue = (
  value: any,
  type: string,
  required: boolean,
  preferUndefined?: boolean
): any => {
  if (type === "location" && value) {
    return {type: "Point", coordinates: [value.lat, value.lng]};
  }

  if (type === "array") {
    return value?.length === 1 && value[0] === "" ? undefined : value;
  }

  if (type === "relation") {
    return Array.isArray(value) ? value.map(v => v.value) : value?.value;
  }

  if (type === "object") {
    const cleanedObject = Object.fromEntries(
      Object.entries(value).map(([key, value]) => {
        const isValueEmpty = value === "" || (Array.isArray(value) && value.length === 0);
        return [key, isValueEmpty ? undefined : value];
      })
    );
    return isObjectEffectivelyEmpty(cleanedObject) ? undefined : cleanedObject;
  }

  return value === "" ? (required ? undefined : preferUndefined ? undefined : value) : value;
};

export const findFirstErrorId = (
  errors: FormError,
  formattedProperties: Properties,
  prefix = ""
): string | null => {
  for (const [key, error] of Object.entries(errors)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const property = formattedProperties[key];

    if (typeof error === "string" && property?.id) {
      return property.id;
    } else if (typeof error === "object" && property?.properties) {
      const nestedId = findFirstErrorId(error, property.properties, fullKey);
      if (nestedId) return nestedId;
    }
  }
  return null;
};

export const generateInitialValues = (properties: Record<string, Property>) => {
  return Object.keys(properties).reduce(
    (acc: Record<string, any>, key) => {
      const property = properties[key];
      const field = FIELD_REGISTRY[property.type] as FieldDefinition;
      if (property.type === "object" && property.properties) {
        acc[key] = generateInitialValues(property.properties);
      } else {
        acc[key] = field.getDefaultValue(property);
      }
      return acc;
    },
    {} as Record<string, any>
  );
};

export const cleanValueRecursive = (
  val: any,
  property: Property,
  required?: boolean,
  preferUndefined?: boolean
): any => {
  if (property?.type === "object" && property.properties) {
    const entries = Object.entries(val || {}).map(([key, value]) => {
      const schema = property.properties[key];
      const isRequired = property.required?.includes(key);
      const cleanedValue = schema ? cleanValueRecursive(value, schema, isRequired, true) : value;
      return [key, cleanedValue];
    });
    const cleanedObject = Object.fromEntries(entries);
    return cleanedObject;
  } else if (property?.type === "array" && property.items) {
    if (!Array.isArray(val)) return val;
    return val.map(v => cleanValueRecursive(v, property.items));
  }
  return cleanValue(val, property?.type, required || false, preferUndefined || false);
};

export const validateValues = (
  value: Record<string, any>,
  formattedProperties: Record<string, Property>,
  requiredFields: string[]
) => {
  const errors: FormError = {};

  for (const [key, property] of Object.entries(formattedProperties || {})) {
        const kind = property.type;
    const field = FIELD_REGISTRY[kind];
    const val = field?.getSaveReadyValue(value[key], property)
    const required = requiredFields?.includes(key) ? true : property.required;
    const msg = field?.validateValue(val, property, required);
    if (msg) errors[key] = msg as string;
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
};

type CollectedRelation = {bucketId: string; value: any};

export function collectBucketIds(Properties: Properties, cellValue: any): CollectedRelation[] {
  const collected: CollectedRelation[] = [];

  function traverse(property: Property, value: any) {
    if (!property || typeof property !== "object") return;
    if (property.type === "relation") {
      const relationValue = value?.[property.title];
      collected.push({bucketId: property.bucketId as string, value: relationValue});
    }
    if (property.type === "object" || property.type === "array") {
      for (const prop of Object.values(property.properties || property.items.properties || {})) {
        const childValue = value?.[(prop as Property).title];
        if (prop && (typeof childValue === "object" || !childValue))
          traverse(prop as Property, childValue);
      }
    }
  }

  for (const prop of Object.values(Properties || {})) {
    traverse(prop, cellValue);
  }
  return collected;
}
