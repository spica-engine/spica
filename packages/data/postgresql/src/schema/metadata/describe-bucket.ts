import {Bucket} from "@spica-server/interface-bucket";
import {ITEMS_SEGMENT} from "@spica-server/bucket-common";
import {assertUnique, BucketSchemaError, SYSTEM_COLUMNS} from "../naming.js";
import {primaryKeyMetadata} from "../primary-key.js";
import {identifiersOf} from "./identifiers.js";
import {attachIndexes, indexOf} from "./indexes.js";
import {propertyProblems} from "./support.js";
import {describeTables} from "./tables.js";
import {BucketMetadata, ColumnMetadata, RelationTargets, TableMetadata} from "./types.js";

const pathKey = (path: string[]) => path.join("\0");

const isLinkColumn = (name: string) =>
  name == SYSTEM_COLUMNS.parent || name == SYSTEM_COLUMNS.position || name == SYSTEM_COLUMNS.locale;

function columnLookup(tables: TableMetadata[]) {
  const byPath = new Map(
    tables.flatMap(table =>
      table.columns
        .filter(column => !isLinkColumn(column.name))
        .map(column => [pathKey(column.path), column] as const)
    )
  );
  return (path: string[]): ColumnMetadata | undefined =>
    byPath.get(pathKey(path.filter(segment => segment != ITEMS_SEGMENT)));
}

function assertSupported(bucket: Bucket) {
  const problems = propertyProblems(bucket);
  if (problems.length) {
    throw new BucketSchemaError(problems);
  }
}

export function describeBucket(
  bucketId: string,
  bucket: Bucket,
  targets: RelationTargets = () => undefined
): BucketMetadata {
  assertSupported(bucket);

  const primaryKey = primaryKeyMetadata(bucket);
  const tables = describeTables(bucketId, bucket, primaryKey, targets);
  const [main, ...children] = tables;
  const columnOf = columnLookup(tables);

  attachIndexes(tables, bucket, columnOf);
  assertUnique(identifiersOf(tables));

  return {
    bucketId,
    primaryKey,
    main,
    children,
    tables,
    columnOf,
    indexOf: index => indexOf(columnOf, index)
  };
}
