import type {SqlDefault, Where} from "./expressions.js";
import {uuidv7} from "./expressions.js";

export type ColumnType =
  | "uuid"
  | "text"
  | "integer"
  | "double precision"
  | "bigint"
  | "boolean"
  | "timestamptz"
  | "jsonb"
  | "text[]"
  | "uuid[]"
  | "timestamptz[]";

export type ColumnDefault =
  | string
  | number
  | boolean
  | readonly unknown[]
  | Record<string, unknown>
  | SqlDefault;

export interface ScalarColumn {
  type: ColumnType;
  column?: string;
  notNull?: boolean;
  default?: ColumnDefault;
  keepNull?: boolean;
}

export interface EmbeddedColumns {
  embedded: Record<string, ScalarColumn | EmbeddedColumns>;
  column?: string;
}

export type ColumnDefinition = ScalarColumn | EmbeddedColumns;

export interface IndexColumn {
  property: string;
  order?: "asc" | "desc";
}

export interface IndexDefinition {
  name?: string;
  columns: (string | IndexColumn)[];
  unique?: boolean;
  using?: "btree" | "gin";
  where?: Where;
}

export interface EntityDefinition {
  table: string;
  idProperty?: string;
  columns: Record<string, ColumnDefinition>;
  indexes?: IndexDefinition[];
}

export interface ResolvedColumn extends ScalarColumn {
  property: string;
  column: string;
  path: string[];
}

export interface ResolvedIndexColumn {
  property: string;
  column: string;
  order: "asc" | "desc";
}

export interface ResolvedIndex {
  name: string;
  keys: string[];
  columns: ResolvedIndexColumn[];
  unique: boolean;
  using: "btree" | "gin";
  where?: Where;
}

export interface Entity<R = unknown> {
  readonly table: string;
  readonly idProperty: string;
  readonly columns: readonly ResolvedColumn[];
  readonly indexes: readonly ResolvedIndex[];
  readonly byProperty: ReadonlyMap<string, ResolvedColumn>;
  readonly byColumn: ReadonlyMap<string, ResolvedColumn>;
  readonly groups: ReadonlyMap<string, readonly ResolvedColumn[]>;
  readonly record?: R;
}

export const ID_PROPERTY = "id";

const MAX_IDENTIFIER_LENGTH = 63;

const snakeCase = (property: string) =>
  property.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const isEmbedded = (definition: ColumnDefinition): definition is EmbeddedColumns =>
  "embedded" in definition;

function resolveColumns(
  table: string,
  definitions: Record<string, ColumnDefinition>,
  path: string[],
  columnPrefix: string,
  groups: Map<string, ResolvedColumn[]>
): ResolvedColumn[] {
  return Object.entries(definitions).flatMap(([key, definition]) => {
    const keyPath = [...path, key];
    const property = keyPath.join(".");
    const name = definition.column ?? snakeCase(key);
    const column = columnPrefix ? `${columnPrefix}_${name}` : name;

    if (isEmbedded(definition)) {
      const nested = resolveColumns(table, definition.embedded, keyPath, column, groups);
      groups.set(property, nested);
      return nested;
    }
    if (path.length && (definition.notNull || definition.default !== undefined)) {
      throw new Error(
        `Embedded column "${table}.${property}" must be nullable and cannot have a default.`
      );
    }
    return [{...definition, property, column, path: keyPath}];
  });
}

export function defineEntity<R = Record<string, unknown>>(definition: EntityDefinition): Entity<R> {
  const idProperty = definition.idProperty ?? ID_PROPERTY;
  if (idProperty in definition.columns) {
    throw new Error(
      `Entity "${definition.table}" must not define "${idProperty}"; it is implicit.`
    );
  }

  const groups = new Map<string, ResolvedColumn[]>();
  const columns: ResolvedColumn[] = [
    {
      property: idProperty,
      column: "id",
      path: [idProperty],
      type: "uuid",
      notNull: true,
      default: uuidv7()
    },
    ...resolveColumns(definition.table, definition.columns, [], "", groups)
  ];

  const byProperty = new Map(columns.map(column => [column.property, column]));
  const byColumn = new Map(columns.map(column => [column.column, column]));
  if (byColumn.size != columns.length) {
    const duplicate = columns.find(
      ({property, column}) => byColumn.get(column)!.property != property
    )!;
    throw new Error(
      `Entity "${definition.table}" maps more than one property to column "${duplicate.column}".`
    );
  }

  const indexes = (definition.indexes ?? []).map(index =>
    resolveIndex(definition.table, index, byProperty)
  );

  return {
    table: definition.table,
    idProperty,
    columns,
    indexes,
    byProperty,
    byColumn,
    groups
  };
}

function resolveIndex(
  table: string,
  index: IndexDefinition,
  byProperty: Map<string, ResolvedColumn>
): ResolvedIndex {
  if (!index.columns.length) {
    throw new Error(`An index on "${table}" needs columns.`);
  }

  const columns = index.columns.map(entry => {
    const {property, order = "asc"} = typeof entry == "string" ? {property: entry} : entry;
    const column = byProperty.get(property);
    if (!column) {
      throw new Error(`Index on "${table}" references unknown property "${property}".`);
    }
    return {property, column: column.column, order};
  });

  const unique = index.unique ?? false;
  const name =
    index.name ?? `${table}_${columns.map(c => c.column).join("_")}_${unique ? "key" : "idx"}`;
  if (name.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(`Index name "${name}" is longer than ${MAX_IDENTIFIER_LENGTH} characters.`);
  }

  return {
    name,
    keys: columns.map(c => c.property),
    columns,
    unique,
    using: index.using ?? "btree",
    where: index.where
  };
}
