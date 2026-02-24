import {constructValue, LogicalExtractor} from "@spica-server/filter";

/**
 * Replaces email and phone fields with their hashed equivalents.
 * - email -> email.hash
 * - phone -> phone.hash
 *
 * @param filter The filter object to transform
 * @param hashFn Function to hash string values
 * @returns Transformed filter with hashed provider fields
 */
export function replaceProviderFilter(filter: object, hashFn: (value: string) => string): object {
  const result = {};

  for (let [key, value] of Object.entries(filter)) {
    if (LogicalExtractor.operators.includes(key)) {
      result[key] = value.map(expression => replaceProviderFilter(expression, hashFn));
      continue;
    }

    if (key === "email" || key === "phone") {
      const hashedKey = `${key}.hash`;
      result[hashedKey] = constructValue(value, hashFn);
    } else {
      result[key] = value;
    }
  }

  return result;
}
