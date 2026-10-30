import {BUCKET_SCHEMA_HOOKS, BucketSchemaExtension} from "@spica-server/interface-bucket";

type BucketSchemaDocument = Record<string, any>;

export function composeBucketSchema(
  base: BucketSchemaDocument,
  extension: BucketSchemaExtension["schema"]
): BucketSchemaDocument {
  const missing = BUCKET_SCHEMA_HOOKS.filter(hook => !(hook in extension.definitions));
  if (missing.length) {
    throw new Error(`The bucket schema extension does not define: ${missing.join(", ")}.`);
  }

  const shadowed = Object.keys(extension.definitions).filter(
    name => name in (base.definitions ?? {})
  );
  if (shadowed.length) {
    throw new Error(`The bucket schema extension redefines: ${shadowed.join(", ")}.`);
  }

  return {
    ...base,
    required: [...(base.required ?? []), ...(extension.required ?? [])],
    definitions: {...base.definitions, ...extension.definitions},
    properties: {...base.properties, ...extension.properties},
    ...(extension.allOf ? {allOf: [...(base.allOf ?? []), ...extension.allOf]} : {})
  };
}
