/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

/**
 * Determines the primary field key for a bucket.
 * 
 * Rules (in order):
 * 1. Property with isPrimary === true
 * 2. Property with key === "title"
 * 3. Fallback: "_id"
 */
export function getPrimaryFieldKey(properties: Record<string, any>): string {
  if (!properties) return "_id";

  // Rule 1: Check for isPrimary flag
  for (const [key, property] of Object.entries(properties)) {
    if (property?.isPrimary === true) {
      return key;
    }
  }

  // Rule 2: Check for "title" key
  if (properties.title !== undefined) {
    return "title";
  }

  // Rule 3: Fallback
  return "_id";
}

/**
 * Extracts the primary field value from a document/item.
 * 
 * @param item - The document object
 * @param properties - Bucket properties schema
 * @returns The value of the primary field
 */
export function extractPrimaryFieldValue(
  item: Record<string, any>,
  properties: Record<string, any>
): string {
  const primaryKey = getPrimaryFieldKey(properties);
  const value = item[primaryKey];
  
  // Convert to string, fallback to _id if empty
  if (value === undefined || value === null || value === "") {
    return item._id || "";
  }
  
  return String(value);
}

