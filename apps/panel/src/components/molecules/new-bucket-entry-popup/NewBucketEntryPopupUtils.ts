import {FIELD_REGISTRY} from "../../../domain/fields";
import type {FieldDefinition} from "src/domain/fields/types";
import type {Property} from "src/services/bucketService";

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
      Object.entries(value).map(([k, v]) => [
        k,
        v === "" || (Array.isArray(v) && v.length === 0) ? undefined : v
      ])
    );
    return isObjectEffectivelyEmpty(cleanedObject) ? undefined : cleanedObject;
  }

  return value === "" ? (required ? undefined : preferUndefined ? undefined : value) : value;
};

export const buildOptionsUrl = (bucketId: string, skip = 0, searchValue?: string) => {
  const base = `${import.meta.env.VITE_BASE_URL}/api/bucket/${bucketId}/data?paginate=true&relation=true&limit=25&sort=%7B%22_id%22%3A-1%7D`;
  const filter = searchValue
    ? `&filter=${encodeURIComponent(
        JSON.stringify({
          $or: [{title: {$regex: searchValue, $options: "i"}}]
        })
      )}`
    : "";

  return `${base}${filter}&skip=${skip}`;
};

export const findFirstErrorId = (
  errors: {[key: string]: string | typeof errors},
  formattedProperties: Record<string, any>,
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
    const cleanedObject = Object.fromEntries(
      Object.entries(val || {}).map(([k, v]) => [
        k,
        property.properties[k]
          ? cleanValueRecursive(v, property.properties[k], property.required?.includes(k), true)
          : v
      ])
    );
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
  type FormError = {[key: string]: string | FormError | Record<number, any>};
  const errors: FormError = {};

  for (const [key, property] of Object.entries(formattedProperties || {})) {
    const val = value?.[key];
    const propertyWithRequired = {
      ...property,
      required: requiredFields?.includes(key) ? true : property.required
    };
    const kind = property.type;
    const field = FIELD_REGISTRY[kind];
    const msg = field?.validateValue(val, propertyWithRequired);
    if (msg) errors[key] = msg as string;
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
};
