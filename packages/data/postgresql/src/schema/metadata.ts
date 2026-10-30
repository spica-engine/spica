import {Bucket} from "@spica-server/interface-bucket";
import {assertUnique, columnName, mainTableName, NamedIdentifier, NamingError} from "./naming.js";
import {primaryKeyMetadata, PrimaryKeyMetadata} from "./primary-key.js";

export type ColumnType =
  | "uuid"
  | "text"
  | "integer"
  | "bigint"
  | "double precision"
  | "boolean"
  | "timestamptz"
  | "jsonb";

export interface ColumnMetadata {
  name: string;
  path: string[];
  type: ColumnType;
  notNull: boolean;
  enum?: unknown[];
}

export interface TableMetadata {
  name: string;
  columns: ColumnMetadata[];
}

export interface BucketMetadata {
  bucketId: string;
  primaryKey: PrimaryKeyMetadata;
  main: TableMetadata;
  columnOf(path: string[]): ColumnMetadata | undefined;
}

const COLUMN_TYPE_OF_PROPERTY: Record<string, ColumnType> = {
  string: "text",
  textarea: "text",
  richtext: "text",
  color: "text",
  storage: "text",
  hash: "text",
  encrypted: "text",
  number: "double precision",
  boolean: "boolean",
  date: "timestamptz",
  json: "jsonb",
  uuid: "uuid",
  integer: "integer",
  bigint: "bigint"
};

export function describeBucket(bucketId: string, bucket: Bucket): BucketMetadata {
  const properties = bucket.properties ?? {};
  const primaryKey = primaryKeyMetadata(bucket);
  const required = new Set(bucket.required ?? []);
  const unsupported: string[] = [];

  const columns: ColumnMetadata[] = [];
  for (const [field, property] of Object.entries(properties)) {
    const type = COLUMN_TYPE_OF_PROPERTY[property.type as string];
    if (!type || property.options?.translate) {
      unsupported.push(
        `${field} (${property.options?.translate ? "translated " : ""}${property.type})`
      );
      continue;
    }
    columns.push({
      name: columnName([field]),
      path: [field],
      type,
      notNull: field == primaryKey.field || required.has(field),
      ...(property.enum ? {enum: [...property.enum]} : {})
    });
  }
  if (unsupported.length) {
    throw new NamingError([
      `Properties are not supported on PostgreSQL yet: ${unsupported.join(", ")}.`
    ]);
  }

  const table = mainTableName(bucketId);
  const identifiers: NamedIdentifier[] = columns.map(column => ({
    scope: `table "${table}"`,
    name: column.name,
    logical: column.path.join("__")
  }));
  assertUnique(identifiers);

  const byPath = new Map(columns.map(column => [column.path.join("\0"), column]));
  return {
    bucketId,
    primaryKey,
    main: {name: table, columns},
    columnOf: path => byPath.get(path.join("\0"))
  };
}
