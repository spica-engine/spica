import {Bucket} from "@spica-server/interface-bucket";
import {columnName, NamingError} from "./naming.js";

export type KeyType = "uuid" | "bigint" | "integer" | "text";

const KEY_TYPE_OF_PROPERTY: Record<string, KeyType> = {
  uuid: "uuid",
  integer: "integer",
  bigint: "bigint",
  string: "text"
};

export interface PrimaryKeyMetadata {
  field: string;
  type: KeyType;
  generated: boolean;
  column: string;
}

export function primaryKeyMetadata(bucket: Bucket): PrimaryKeyMetadata {
  const field = bucket.primary;
  const property = field ? bucket.properties?.[field] : undefined;
  const type = property && KEY_TYPE_OF_PROPERTY[property.type as string];
  if (!type) {
    throw new NamingError([
      `primary must name a uuid, integer, bigint or string property, but "${field}" does not.`
    ]);
  }
  return {
    field,
    type,
    generated: Boolean(property.options?.generated),
    column: columnName([field])
  };
}
