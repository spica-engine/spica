import {decrypt, EncryptedData} from "@spica-server/core/schema";
import {Bucket} from "@spica-server/interface/bucket";

function isEncryptedData(value: unknown): value is EncryptedData {
  return (
    typeof value === "object" &&
    value !== null &&
    "encrypted" in value &&
    "iv" in value &&
    "authTag" in value
  );
}

export function decryptDocumentFields<T extends Record<string, any>>(
  document: T,
  schema: Bucket,
  encryptionSecret: string
): T {
  if (!document || !schema?.properties || !encryptionSecret) {
    return document;
  }

  const result: Record<string, any> = {...document};

  for (const [key, propertySchema] of Object.entries(schema.properties)) {
    if (!(key in result)) {
      continue;
    }

    if (propertySchema.type === "encrypted" && isEncryptedData(result[key])) {
      result[key] = decrypt(result[key], encryptionSecret);
    } else if (
      propertySchema.type === "object" &&
      typeof propertySchema.properties === "object" &&
      typeof result[key] === "object" &&
      result[key] !== null
    ) {
      result[key] = decryptDocumentFields(
        result[key],
        {properties: propertySchema.properties} as Bucket,
        encryptionSecret
      );
    } else if (
      propertySchema.type === "array" &&
      Array.isArray(result[key]) &&
      typeof propertySchema.items === "object"
    ) {
      const itemSchema = propertySchema.items as any;
      if (itemSchema.type === "encrypted") {
        result[key] = result[key].map((item: unknown) =>
          isEncryptedData(item) ? decrypt(item, encryptionSecret) : item
        );
      } else if (itemSchema.type === "object" && typeof itemSchema.properties === "object") {
        result[key] = result[key].map((item: Record<string, any>) =>
          decryptDocumentFields(
            item,
            {properties: itemSchema.properties} as Bucket,
            encryptionSecret
          )
        );
      }
    }
  }

  return result as T;
}
