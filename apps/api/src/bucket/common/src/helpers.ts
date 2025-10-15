import {Bucket, BucketDocument} from "@spica-server/interface/bucket";
import {hashValue} from "./hash";

export function categorizePropertyMap(propertyMap: string[][]) {
  const documentPropertyMap: string[][] = [];
  const authPropertyMap: string[][] = [];

  propertyMap.forEach(pmap =>
    pmap[0] == "auth"
      ? authPropertyMap.push(pmap.slice(1))
      : documentPropertyMap.push(pmap.slice(1))
  );

  return {documentPropertyMap, authPropertyMap};
}

/**
 * Transform data by applying hashing to 'hashed' type fields.
 *
 * This function serves as a preprocessing step for both write operations (documents)
 * and for transforming filter objects used in query operations (filters). When a hashingKey is provided
 * and the schema contains 'hashed' type fields, it transforms the data or filter accordingly.
 * If no hashingKey is provided or no hashed fields exist, the data passes through unchanged.
 */
export function handleDataHashing<T>(
  data: T,
  schema: Bucket,
  hashingKey: string | undefined,
  isFilter: boolean = false
): T {
  if (!hashingKey || !schema.properties || !data) {
    return data;
  }

  if (isFilter) {
    return hashFilterData(data, schema, hashingKey);
  } else {
    return hashDocumentData(data as BucketDocument, schema, hashingKey) as T;
  }
}

/**
 * Hash document fields for operations
 */
function hashDocumentData(
  document: BucketDocument,
  schema: Bucket,
  hashingKey: string
): BucketDocument {
  const hashedDocument = {...document};

  for (const [fieldName, value] of Object.entries(document)) {
    if (value !== undefined) {
      hashedDocument[fieldName] = hashSingleFieldValue(fieldName, value, schema, hashingKey);
    }
  }

  return hashedDocument;
}

/**
 * Hash filter fields for operations
 */
function hashFilterData(filter: any, schema: Bucket, hashingKey: string): any {
  if (!filter || typeof filter !== "object") {
    return filter;
  }

  const hashedFilter = {...filter};

  for (const [fieldName, fieldValue] of Object.entries(filter)) {
    if (fieldValue === undefined) continue;

    hashedFilter[fieldName] = hashFilterFieldValue(fieldName, fieldValue, schema, hashingKey);
  }

  return hashedFilter;
}

/**
 * Hash a single field value if it's a hashed field type
 */
function hashSingleFieldValue(
  fieldName: string,
  value: any,
  schema: Bucket,
  hashingKey: string
): any {
  if (!schema.properties) {
    return value;
  }

  const property = schema.properties[fieldName];

  if (!isHashedField(property) || typeof value !== "string") {
    return value;
  }

  return hashValue(value, hashingKey);
}

/**
 * Hash filter values (handles MongoDB operators)
 */
function hashFilterFieldValue(
  fieldName: string,
  fieldValue: any,
  schema: Bucket,
  hashingKey: string
): any {
  if (typeof fieldValue === "string") {
    return hashSingleFieldValue(fieldName, fieldValue, schema, hashingKey);
  }

  if (typeof fieldValue === "object" && fieldValue !== null) {
    return hashObjectValues(fieldValue, fieldName, schema, hashingKey);
  }

  return fieldValue;
}

/**
 * Recursively hash any string values in an object (handles all MongoDB operators)
 */
function hashObjectValues(obj: any, fieldName: string, schema: Bucket, hashingKey: string): any {
  if (Array.isArray(obj)) {
    // Handle arrays: ["value1", "value2"] -> ["hashed1", "hashed2"]
    return obj.map(item =>
      typeof item === "string"
        ? hashSingleFieldValue(fieldName, item, schema, hashingKey)
        : hashObjectValues(item, fieldName, schema, hashingKey)
    );
  }

  if (typeof obj === "object" && obj !== null) {
    // Handle objects: { $eq: "value" } -> { $eq: "hashedValue" }
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = hashSingleFieldValue(fieldName, value, schema, hashingKey);
      } else {
        result[key] = hashObjectValues(value, fieldName, schema, hashingKey);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Check if a bucket property is of type 'hashed'
 */
function isHashedField(property: any): boolean {
  return property && property.type === "hashed";
}
