import {Bucket} from "@spica-server/interface-bucket";
import {
  assertUnique,
  BucketSchemaError,
  columnName,
  constraintName,
  mainTableName,
  NamedIdentifier
} from "./naming.js";
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
  checkName?: string;
}

export interface IndexMetadata {
  name: string;
  unique: boolean;
  columns: {name: string; order: "asc" | "desc"}[];
}

export interface TableMetadata {
  name: string;
  columns: ColumnMetadata[];
  indexes: IndexMetadata[];
}

export interface BucketMetadata {
  bucketId: string;
  primaryKey: PrimaryKeyMetadata;
  main: TableMetadata;
  columnOf(path: string[]): ColumnMetadata | undefined;
  indexOf(index: IndexDefinition): IndexMetadata;
}

type IndexDefinition = NonNullable<Bucket["indexes"]>[number];

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

const SUPPORTED_INDEX_OPTIONS = new Set(["unique", "sparse", "background"]);

const keyOf = (path: string[]) => path.join("\0");

function propertyProblems(bucket: Bucket) {
  const problems: string[] = [];
  const unsupported: string[] = [];
  for (const [field, property] of Object.entries(bucket.properties ?? {})) {
    if (!COLUMN_TYPE_OF_PROPERTY[property.type as string] || property.options?.translate) {
      unsupported.push(
        `${field} (${property.options?.translate ? "translated " : ""}${property.type})`
      );
    }
  }
  if (unsupported.length) {
    problems.push(`Properties are not supported on PostgreSQL yet: ${unsupported.join(", ")}.`);
  }
  return problems;
}

function describeIndex(
  table: string,
  columnOf: (path: string[]) => ColumnMetadata | undefined,
  index: IndexDefinition
): {metadata?: IndexMetadata; problems: string[]} {
  const problems: string[] = [];
  const columns: IndexMetadata["columns"] = [];
  const label = JSON.stringify(index.definition);

  for (const [field, direction] of Object.entries(index.definition)) {
    const column = columnOf(field.split("."));
    if (!column) {
      problems.push(`Index ${label} refers to "${field}", which is not a property of the bucket.`);
    } else if (direction !== 1 && direction !== -1) {
      problems.push(
        `Index ${label} uses "${direction}", only 1 and -1 are supported on PostgreSQL.`
      );
    } else {
      columns.push({name: column.name, order: direction == 1 ? "asc" : "desc"});
    }
  }

  const options = index.options ?? {};
  for (const option of Object.keys(options).filter(name => !SUPPORTED_INDEX_OPTIONS.has(name))) {
    problems.push(
      `Index ${label} uses the "${option}" option, which PostgreSQL does not support yet.`
    );
  }

  if (problems.length) {
    return {problems};
  }

  const unique = Boolean(options.unique);
  const name = constraintName(
    table,
    columns.map(column => (column.order == "desc" ? `${column.name}_desc` : column.name)),
    unique ? "uq" : "ix"
  );
  return {metadata: {name, unique, columns}, problems};
}

export function describeBucket(bucketId: string, bucket: Bucket): BucketMetadata {
  const problems = propertyProblems(bucket);
  if (problems.length) {
    throw new BucketSchemaError(problems);
  }

  const primaryKey = primaryKeyMetadata(bucket);
  const required = new Set(bucket.required ?? []);
  const table = mainTableName(bucketId);

  const columns: ColumnMetadata[] = Object.entries(bucket.properties ?? {}).map(
    ([field, property]) => {
      const name = columnName([field]);
      return {
        name,
        path: [field],
        type: COLUMN_TYPE_OF_PROPERTY[property.type as string],
        notNull: field == primaryKey.field || required.has(field),
        ...(property.enum?.length
          ? {enum: [...property.enum], checkName: constraintName(table, [name], "ck")}
          : {})
      };
    }
  );

  const byPath = new Map(columns.map(column => [keyOf(column.path), column]));
  const columnOf = (path: string[]) => byPath.get(keyOf(path));

  const indexProblems: string[] = [];
  const indexes: IndexMetadata[] = [];
  for (const index of bucket.indexes ?? []) {
    const described = describeIndex(table, columnOf, index);
    indexProblems.push(...described.problems);
    if (described.metadata) {
      indexes.push(described.metadata);
    }
  }
  if (indexProblems.length) {
    throw new BucketSchemaError(indexProblems);
  }

  const identifiers: NamedIdentifier[] = [
    ...columns.map(column => ({
      scope: `table "${table}"`,
      name: column.name,
      logical: column.path.join("__")
    })),
    ...indexes.map(index => ({scope: "the schema", name: index.name, logical: index.name})),
    ...columns
      .filter(column => column.checkName)
      .map(column => ({
        scope: "the schema",
        name: column.checkName,
        logical: `${column.name} check`
      })),
    {
      scope: "the schema",
      name: constraintName(table, [primaryKey.column], "pk"),
      logical: "primary key"
    }
  ];
  assertUnique(identifiers);

  return {
    bucketId,
    primaryKey,
    main: {name: table, columns, indexes},
    columnOf,
    indexOf: index => {
      const {metadata, problems} = describeIndex(table, columnOf, index);
      if (!metadata) {
        throw new BucketSchemaError(problems);
      }
      return metadata;
    }
  };
}
