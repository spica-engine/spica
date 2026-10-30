import {Keyword} from "@spica-server/interface-core";

export interface BucketSchemaExtension {
  schema: {
    definitions: Record<string, unknown>;
    properties?: Record<string, unknown>;
    required?: string[];
    allOf?: unknown[];
  };
  keywords?: Keyword[];
}

export const BUCKET_SCHEMA_EXTENSION = Symbol.for("BUCKET_SCHEMA_EXTENSION");

export const BUCKET_SCHEMA_HOOKS = [
  "id",
  "propertyName",
  "propertyType",
  "bucketReference",
  "propertyOptions",
  "propertyRules",
  "itemSchema",
  "indexes"
] as const;
