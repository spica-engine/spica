/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

export function getPrimaryFieldKey(properties: Record<string, any>): string {
  if (!properties) return "_id";

  for (const [key, property] of Object.entries(properties)) {
    if (property?.isPrimary === true) {
      return key;
    }
  }

  if (properties.title !== undefined) {
    return "title";
  }

  return "_id";
}

export function extractPrimaryFieldValue(
  item: Record<string, any>,
  properties: Record<string, any>
): string {
  const primaryKey = getPrimaryFieldKey(properties);
  const value = item[primaryKey];
  
  if (value === undefined || value === null || value === "") {
    return item._id || "";
  }
  
  return String(value);
}

