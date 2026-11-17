import {quote} from "@spica-server/data-postgresql-orm";
import {BucketMetadata} from "../metadata/index.js";
import {PrimaryKeyMetadata} from "../primary-key.js";

export interface KeyChange {
  table: string;
  previous: PrimaryKeyMetadata;
  next: PrimaryKeyMetadata;
}

export const MAP_TABLE = "spica_key_map";
export const MAP_FUNCTION = "spica_map_key";

export const keyMapFunction = (column: string) => `pg_temp.${MAP_FUNCTION}(${quote(column)})`;

export function keyChangeOf(previous: BucketMetadata, next: BucketMetadata): KeyChange | undefined {
  const before = previous.primaryKey;
  const after = next.primaryKey;
  if (
    before.field == after.field &&
    before.type == after.type &&
    before.generated == after.generated
  ) {
    return undefined;
  }
  return {table: previous.main.name, previous: before, next: after};
}

export const movesKeyValues = (change: KeyChange) =>
  change.previous.field != change.next.field || change.previous.type != change.next.type;

export const remapsKeyValues = (change?: KeyChange) =>
  Boolean(change) && change.previous.field != change.next.field;
