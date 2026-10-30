import {composeBucketSchema} from "@spica-server/bucket-common";
import {OBJECT_ID, OBJECTID_STRING, UUID, DATE_TIME, Validator} from "@spica-server/core-schema";
import {BucketSchemaExtension} from "@spica-server/interface-bucket";
import BaseSchema from "../src/schemas/bucket.schema.json" with {type: "json"};
import OriginalSchema from "./fixtures/bucket.schema.original.json" with {type: "json"};

export const SCHEMA_ID = "http://spica.internal/bucket/schema";

const CUSTOM_FIELDS = [
  "primary",
  "options",
  "bucketId",
  "relationType",
  "dependent",
  "locationType",
  "acl"
];

function createValidator(extension?: BucketSchemaExtension) {
  return new Validator(
    {
      formats: [OBJECT_ID, OBJECTID_STRING, UUID, DATE_TIME],
      customFields: CUSTOM_FIELDS,
      keywords: extension?.keywords ?? []
    },
    {}
  );
}

export function validatorFor(extension: BucketSchemaExtension) {
  const validator = createValidator(extension);
  validator.registerSchema(composeBucketSchema(BaseSchema, extension.schema) as {$id: string});
  return validator;
}

export function originalValidator() {
  const validator = createValidator();
  validator.registerSchema({...OriginalSchema, $id: "http://spica.internal/bucket/original"});
  return validator;
}

export async function violations(validator: Validator, id: string, definition: unknown) {
  try {
    await validator.validate(id, structuredClone(definition));
    return [];
  } catch (error) {
    return (error.errors ?? [error]).map((e: any) => `${e.instancePath ?? ""} ${e.message}`.trim());
  }
}
