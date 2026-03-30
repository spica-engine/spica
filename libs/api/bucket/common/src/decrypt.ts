import {decrypt, isEncryptedData, BaseEncryptedData} from "@spica-server/core/encryption";
import {Bucket} from "@spica-server/interface/bucket";
import {RelationType} from "@spica-server/interface/bucket/common";

type SchemaResolver = (bucketId: string) => Promise<Bucket> | Bucket;

function isRelation(propertySchema: any): boolean {
  return propertySchema?.type === "relation";
}

function isPopulatedRelation(value: unknown): boolean {
  if (!value) return false;

  if (Array.isArray(value)) {
    return value.length > 0 && typeof value[0] === "object" && value[0] !== null;
  }

  return typeof value === "object" && !isEncryptedData(value);
}

export function decryptDocumentFields<T extends Record<string, any>>(
  document: T,
  schema: Bucket,
  encryptionSecret: string,
  schemaResolver: SchemaResolver,
  documentId?: string
): T {
  if (!document || !schema?.properties || !encryptionSecret) {
    return document;
  }

  const docId = documentId ?? (document._id as string);
  const result: Record<string, any> = {...document};

  for (const [key, propertySchema] of Object.entries(schema.properties)) {
    if (!(key in result)) continue;

    result[key] = handleProperty({
      key,
      value: result[key],
      propertySchema,
      docId,
      encryptionSecret,
      schemaResolver
    });
  }

  return result as T;
}

function handleProperty(params: {
  key: string;
  value: any;
  propertySchema: any;
  docId: string;
  encryptionSecret: string;
  schemaResolver: SchemaResolver;
}) {
  const {value, propertySchema, docId, encryptionSecret, schemaResolver} = params;

  if (propertySchema.type === "encrypted") {
    return handleEncrypted(value, encryptionSecret, docId);
  }

  if (isRelation(propertySchema)) {
    return handleRelation(value, propertySchema, encryptionSecret, schemaResolver);
  }

  if (propertySchema.type === "object") {
    return handleObject(value, propertySchema, encryptionSecret, schemaResolver, docId);
  }

  if (propertySchema.type === "array") {
    return handleArray(value, propertySchema, encryptionSecret, schemaResolver, docId);
  }

  return value;
}

function handleEncrypted(value: unknown, secret: string, docId: string) {
  if (!isEncryptedData(value)) return value;
  return decryptWithErrorHandling(value, secret, docId);
}

function handleRelation(
  value: any,
  propertySchema: any,
  secret: string,
  schemaResolver: SchemaResolver
) {
  if (!isPopulatedRelation(value)) return value;

  const relatedSchema = resolveRelatedSchema(propertySchema.bucketId, schemaResolver);

  if (!relatedSchema) return value;

  if (propertySchema.relationType === RelationType.One) {
    return decryptRelatedDocument(value, relatedSchema, secret, schemaResolver);
  }

  if (propertySchema.relationType === RelationType.Many && Array.isArray(value)) {
    return value.map(item => decryptRelatedDocument(item, relatedSchema, secret, schemaResolver));
  }

  return value;
}

function handleObject(
  value: any,
  propertySchema: any,
  secret: string,
  schemaResolver: SchemaResolver,
  docId: string
) {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof propertySchema.properties !== "object"
  ) {
    return value;
  }

  return decryptDocumentFields(
    value,
    {properties: propertySchema.properties} as Bucket,
    secret,
    schemaResolver,
    docId
  );
}

function handleArray(
  value: any,
  propertySchema: any,
  secret: string,
  schemaResolver: SchemaResolver,
  docId: string
) {
  if (!Array.isArray(value) || typeof propertySchema.items !== "object") {
    return value;
  }

  const itemSchema = propertySchema.items;

  if (itemSchema.type === "encrypted") {
    return value.map(item =>
      isEncryptedData(item) ? decryptWithErrorHandling(item, secret, docId) : item
    );
  }

  if (itemSchema.type === "object" && typeof itemSchema.properties === "object") {
    return value.map(item =>
      decryptDocumentFields(
        item,
        {properties: itemSchema.properties} as Bucket,
        secret,
        schemaResolver,
        docId
      )
    );
  }

  return value;
}

function resolveRelatedSchema(
  bucketId: string,
  schemaResolver: SchemaResolver
): Bucket | undefined {
  try {
    const resolved = schemaResolver(bucketId);
    return resolved instanceof Promise ? undefined : resolved;
  } catch {
    return undefined;
  }
}

function decryptRelatedDocument(
  value: any,
  relatedSchema: Bucket,
  secret: string,
  schemaResolver: SchemaResolver
) {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  return decryptDocumentFields(value, relatedSchema, secret, schemaResolver, value._id);
}

function decryptWithErrorHandling(
  encryptedData: BaseEncryptedData,
  secret: string,
  documentId: string
): string {
  try {
    return decrypt(encryptedData, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`Decryption failed for document ${documentId}: ${message}`);
  }
}
