import {Bucket} from "@spica-server/interface-bucket";
import {ITEMS_SEGMENT} from "@spica-server/bucket-common";
import {
  assertUnique,
  BucketSchemaError,
  columnName,
  constraintName,
  fieldTableName,
  mainTableName,
  NamedIdentifier,
  SYSTEM_COLUMNS
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
  table: string;
  name: string;
  path: string[];
  type: ColumnType;
  notNull: boolean;
  enum?: unknown[];
  checkName?: string;
}

export interface IndexMetadata {
  table: string;
  name: string;
  unique: boolean;
  columns: {name: string; order: "asc" | "desc"}[];
}

export interface ForeignKeyMetadata {
  name: string;
  column: string;
  table: string;
  referencedColumn: string;
  onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
}

export interface TableMetadata {
  name: string;
  path: string[];
  columns: ColumnMetadata[];
  indexes: IndexMetadata[];
  keyColumns: string[];
  foreignKeys: ForeignKeyMetadata[];
}

export interface RelationTarget {
  table: string;
  primaryKey: PrimaryKeyMetadata;
}

export type RelationTargets = (bucketId: string) => RelationTarget | undefined;

export interface BucketMetadata {
  bucketId: string;
  primaryKey: PrimaryKeyMetadata;
  main: TableMetadata;
  children: TableMetadata[];
  tables: TableMetadata[];
  columnOf(path: string[]): ColumnMetadata | undefined;
  indexOf(index: IndexDefinition): IndexMetadata;
}

type IndexDefinition = NonNullable<Bucket["indexes"]>[number];

type Property = NonNullable<Bucket["properties"]>[string];

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

const relationTypeOf = (property: Property) => (property as {relationType?: string}).relationType;

const isArray = (property: Property) => property.type == "array" || property.type == "multiselect";

const isStructuredObject = (property: Property) =>
  property.type == "object" && Boolean(property.properties);

function unsupportedReason(property: Property, insideArray: boolean): string | undefined {
  if (property.options?.translate) {
    if (insideArray) {
      return `translated ${property.type} inside an array`;
    }
    if (!COLUMN_TYPE_OF_PROPERTY[property.type as string]) {
      return `translated ${property.type}`;
    }
    return undefined;
  }
  if (property.type == "relation") {
    return insideArray && relationTypeOf(property) == "onetomany"
      ? "onetomany relation inside an array"
      : undefined;
  }
  if (isArray(property)) {
    if (insideArray) {
      return `nested ${property.type}`;
    }
    const items = property.items as Property | undefined;
    if (!items || Array.isArray(items)) {
      return undefined;
    }
    if (items.type == "relation") {
      return `${property.type} of relation`;
    }
    const reason = unsupportedReason(items, true);
    return reason && (isStructuredObject(items) ? reason : `${property.type} of ${reason}`);
  }
  if (isStructuredObject(property)) {
    for (const child of Object.values(property.properties)) {
      const reason = unsupportedReason(child as Property, insideArray);
      if (reason) {
        return reason;
      }
    }
    return undefined;
  }
  if (property.type == "object" || COLUMN_TYPE_OF_PROPERTY[property.type as string]) {
    return undefined;
  }
  return property.type as string;
}

function propertyProblems(bucket: Bucket) {
  const problems: string[] = [];
  const unsupported: string[] = [];
  const visit = (properties: Record<string, Property>, prefix: string[]) => {
    for (const [field, property] of Object.entries(properties)) {
      const reason = unsupportedReason(property, false);
      if (reason) {
        unsupported.push(`${[...prefix, field].join(".")} (${reason})`);
        continue;
      }
      const items = property.items as Property | undefined;
      const children = isStructuredObject(property)
        ? property.properties
        : isArray(property) && items && !Array.isArray(items) && isStructuredObject(items)
          ? items.properties
          : undefined;
      if (children) {
        visit(children as Record<string, Property>, [...prefix, field]);
      }
    }
  };
  visit(bucket.properties ?? {}, []);
  if (unsupported.length) {
    problems.push(`Properties are not supported on PostgreSQL yet: ${unsupported.join(", ")}.`);
  }
  return problems;
}

class TableBuilder {
  readonly columns: ColumnMetadata[] = [];
  readonly foreignKeys: ForeignKeyMetadata[] = [];

  constructor(
    readonly name: string,
    readonly path: string[],
    readonly keyedBy: "position" | "locale" = "position"
  ) {}

  add(column: Omit<ColumnMetadata, "table" | "checkName">) {
    this.columns.push({
      ...column,
      table: this.name,
      ...(column.enum ? {checkName: constraintName(this.name, [column.name], "ck")} : {})
    });
  }

  reference(column: string, target: RelationTarget, onDelete: ForeignKeyMetadata["onDelete"]) {
    this.foreignKeys.push({
      name: constraintName(this.name, [column], "fk"),
      column,
      table: target.table,
      referencedColumn: target.primaryKey.column,
      onDelete
    });
  }
}

function describeTables(
  bucketId: string,
  bucket: Bucket,
  primaryKey: PrimaryKeyMetadata,
  targets: RelationTargets
): {tables: TableMetadata[]; translated: Set<string>} {
  const mainName = mainTableName(bucketId);
  const targetOf = (path: string[], targetId: string): RelationTarget => {
    const target = targetId == bucketId ? {table: mainName, primaryKey} : targets(targetId);
    if (!target) {
      throw new BucketSchemaError([
        `Relation "${path.join(".")}" refers to the bucket "${targetId}", which does not exist.`
      ]);
    }
    return target;
  };
  const main = new TableBuilder(mainName, []);
  const children: TableBuilder[] = [];
  const translated = new Set<string>();
  const requiredAtTop = new Set(bucket.required ?? []);

  const collect = (
    table: TableBuilder,
    path: string[],
    property: Property,
    required: boolean,
    insideArray: boolean
  ) => {
    const relative = path.slice(table.path.length);

    if (isStructuredObject(property)) {
      const requiredChildren = new Set(property.required ?? []);
      for (const [name, child] of Object.entries(property.properties)) {
        collect(
          table,
          [...path, name],
          child as Property,
          (insideArray || required) && requiredChildren.has(name),
          insideArray
        );
      }
      return;
    }

    if (property.options?.translate) {
      const translations = new TableBuilder(fieldTableName(bucketId, path), path, "locale");
      children.push(translations);
      translated.add(keyOf(path));
      translations.add({name: SYSTEM_COLUMNS.locale, path, type: "text", notNull: true});
      translations.add({
        name: SYSTEM_COLUMNS.value,
        path,
        type: COLUMN_TYPE_OF_PROPERTY[property.type as string],
        notNull: true,
        ...(property.enum?.length ? {enum: [...property.enum]} : {})
      });
      return;
    }

    if (property.type == "relation") {
      const relation = property as Property & {bucketId: string; relationType: string};
      const target = targetOf(path, relation.bucketId);
      if (relation.relationType == "onetomany") {
        const link = new TableBuilder(fieldTableName(bucketId, path), path);
        children.push(link);
        link.add({
          name: SYSTEM_COLUMNS.target,
          path,
          type: target.primaryKey.type,
          notNull: true
        });
        link.reference(SYSTEM_COLUMNS.target, target, "CASCADE");
      } else {
        const name = columnName(relative);
        table.add({name, path, type: target.primaryKey.type, notNull: required});
        table.reference(name, target, required ? "RESTRICT" : "SET NULL");
      }
      return;
    }

    if (isArray(property) && !insideArray) {
      const items = property.items as Property | undefined;
      if (items && !Array.isArray(items)) {
        const child = new TableBuilder(fieldTableName(bucketId, path), path);
        children.push(child);
        if (isStructuredObject(items)) {
          collect(child, path, items, true, true);
        } else {
          child.add({
            name: SYSTEM_COLUMNS.value,
            path,
            type: COLUMN_TYPE_OF_PROPERTY[items.type as string] ?? "jsonb",
            notNull: true,
            ...(items.enum?.length ? {enum: [...items.enum]} : {})
          });
        }
        return;
      }
    }

    const type =
      isStructuredObject(property) || isArray(property) || property.type == "object"
        ? "jsonb"
        : COLUMN_TYPE_OF_PROPERTY[property.type as string];
    table.add({
      name: columnName(relative),
      path,
      type,
      notNull: required,
      ...(property.enum?.length ? {enum: [...property.enum]} : {})
    });
  };

  for (const [field, property] of Object.entries(bucket.properties ?? {})) {
    if (field == primaryKey.field) {
      main.add({
        name: primaryKey.column,
        path: [field],
        type: primaryKey.type,
        notNull: true,
        ...(property.enum?.length ? {enum: [...property.enum]} : {})
      });
    } else {
      collect(main, [field], property as Property, requiredAtTop.has(field), false);
    }
  }

  const toMetadata = (builder: TableBuilder, isMain: boolean): TableMetadata => {
    if (isMain) {
      return {
        name: builder.name,
        path: builder.path,
        columns: builder.columns,
        indexes: [],
        keyColumns: [primaryKey.column],
        foreignKeys: builder.foreignKeys
      };
    }
    const keyColumn = builder.keyedBy == "locale" ? SYSTEM_COLUMNS.locale : SYSTEM_COLUMNS.position;
    const columns: ColumnMetadata[] = [
      {
        table: builder.name,
        name: SYSTEM_COLUMNS.parent,
        path: builder.path,
        type: primaryKey.type,
        notNull: true
      },
      ...(builder.keyedBy == "position"
        ? [
            {
              table: builder.name,
              name: SYSTEM_COLUMNS.position,
              path: builder.path,
              type: "integer" as const,
              notNull: true
            }
          ]
        : []),
      ...builder.columns
    ];
    return {
      name: builder.name,
      path: builder.path,
      columns,
      indexes: [],
      keyColumns: [SYSTEM_COLUMNS.parent, keyColumn],
      foreignKeys: [
        {
          name: constraintName(builder.name, [SYSTEM_COLUMNS.parent], "fk"),
          column: SYSTEM_COLUMNS.parent,
          table: mainName,
          referencedColumn: primaryKey.column,
          onDelete: "CASCADE"
        },
        ...builder.foreignKeys
      ]
    };
  };

  return {
    tables: [toMetadata(main, true), ...children.map(child => toMetadata(child, false))],
    translated
  };
}

function describeIndex(
  columnOf: (path: string[]) => ColumnMetadata | undefined,
  isTranslated: (path: string[]) => boolean,
  index: IndexDefinition
): {metadata?: IndexMetadata; problems: string[]} {
  const problems: string[] = [];
  const columns: (IndexMetadata["columns"][number] & {table: string})[] = [];
  const label = JSON.stringify(index.definition);

  for (const [field, direction] of Object.entries(index.definition)) {
    const column = columnOf(field.split("."));
    if (isTranslated(field.split("."))) {
      problems.push(
        `Index ${label} refers to "${field}", and indexes on translated properties are not supported on PostgreSQL yet.`
      );
    } else if (!column) {
      problems.push(`Index ${label} refers to "${field}", which is not a property of the bucket.`);
    } else if (direction !== 1 && direction !== -1) {
      problems.push(
        `Index ${label} uses "${direction}", only 1 and -1 are supported on PostgreSQL.`
      );
    } else {
      columns.push({
        table: column.table,
        name: column.name,
        order: direction == 1 ? "asc" : "desc"
      });
    }
  }

  if (new Set(columns.map(column => column.table)).size > 1) {
    problems.push(`Index ${label} spans more than one table, which PostgreSQL cannot index.`);
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

  const [{table}] = columns;
  const unique = Boolean(options.unique);
  const name = constraintName(
    table,
    columns.map(column => (column.order == "desc" ? `${column.name}_desc` : column.name)),
    unique ? "uq" : "ix"
  );
  return {
    metadata: {
      table,
      name,
      unique,
      columns: columns.map(({name, order}) => ({name, order}))
    },
    problems
  };
}

export function describeBucket(
  bucketId: string,
  bucket: Bucket,
  targets: RelationTargets = () => undefined
): BucketMetadata {
  const problems = propertyProblems(bucket);
  if (problems.length) {
    throw new BucketSchemaError(problems);
  }

  const primaryKey = primaryKeyMetadata(bucket);
  const {
    tables: [main, ...children],
    translated
  } = describeTables(bucketId, bucket, primaryKey, targets);

  const byPath = new Map(
    [main, ...children].flatMap(table =>
      table.columns
        .filter(column => !isLinkColumn(column.name))
        .map(column => [keyOf(column.path), column] as const)
    )
  );
  const columnOf = (path: string[]) => byPath.get(keyOf(path.filter(s => s != ITEMS_SEGMENT)));

  const isTranslated = (path: string[]) =>
    path.some((_, length) => translated.has(keyOf(path.slice(0, length + 1))));

  const indexProblems: string[] = [];
  for (const index of bucket.indexes ?? []) {
    const described = describeIndex(columnOf, isTranslated, index);
    indexProblems.push(...described.problems);
    if (described.metadata) {
      [main, ...children]
        .find(table => table.name == described.metadata.table)
        .indexes.push(described.metadata);
    }
  }
  if (indexProblems.length) {
    throw new BucketSchemaError(indexProblems);
  }

  const tables = [main, ...children];
  const identifiers: NamedIdentifier[] = [
    ...tables.flatMap(table => [
      {
        scope: "the schema",
        name: table.name,
        logical: `table for ${table.path.join(".") || "the bucket"}`
      },
      ...table.columns.map(column => ({
        scope: `table "${table.name}"`,
        name: column.name,
        logical: column.path.join("__")
      })),
      ...table.indexes.map(index => ({scope: "the schema", name: index.name, logical: index.name})),
      ...table.columns
        .filter(column => column.checkName)
        .map(column => ({
          scope: "the schema",
          name: column.checkName,
          logical: `${column.name} check`
        })),
      {
        scope: "the schema",
        name: constraintName(table.name, table.keyColumns, "pk"),
        logical: `primary key of ${table.name}`
      },
      ...table.foreignKeys.map(key => ({
        scope: "the schema",
        name: key.name,
        logical: `foreign key of ${table.name}`
      }))
    ])
  ];
  assertUnique(identifiers);

  return {
    bucketId,
    primaryKey,
    main,
    children,
    tables,
    columnOf,
    indexOf: index => {
      const {metadata, problems} = describeIndex(columnOf, isTranslated, index);
      if (!metadata) {
        throw new BucketSchemaError(problems);
      }
      return metadata;
    }
  };
}

const isLinkColumn = (name: string) =>
  name == SYSTEM_COLUMNS.parent || name == SYSTEM_COLUMNS.position || name == SYSTEM_COLUMNS.locale;
