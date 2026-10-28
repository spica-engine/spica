export type ColumnType =
  | "uuid"
  | "text"
  | "integer"
  | "bigint"
  | "boolean"
  | "timestamptz"
  | "jsonb"
  | "text[]"
  | "uuid[]"
  | "timestamptz[]";

export interface ColumnDefinition {
  type: ColumnType;
  column?: string;
  notNull?: boolean;
  default?: string | number | boolean | readonly unknown[] | Record<string, unknown>;
}

export interface IndexDefinition {
  name?: string;
  columns?: string[];
  expression?: string;
  unique?: boolean;
  using?: "btree" | "gin";
  where?: string;
}

export interface EntityDefinition {
  table: string;
  columns: Record<string, ColumnDefinition>;
  indexes?: IndexDefinition[];
}

export interface ResolvedColumn extends ColumnDefinition {
  property: string;
  column: string;
}

export interface ResolvedIndex {
  name: string;
  columns?: string[];
  expression?: string;
  unique: boolean;
  using: "btree" | "gin";
  where?: string;
}

export interface Entity<R = unknown> {
  readonly table: string;
  readonly columns: readonly ResolvedColumn[];
  readonly indexes: readonly ResolvedIndex[];
  readonly byProperty: ReadonlyMap<string, ResolvedColumn>;
  readonly byColumn: ReadonlyMap<string, ResolvedColumn>;
  readonly record?: R;
}

export const ID_PROPERTY = "id";

const MAX_IDENTIFIER_LENGTH = 63;

const snakeCase = (property: string) =>
  property.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

export function defineEntity<R = Record<string, unknown>>(definition: EntityDefinition): Entity<R> {
  if (ID_PROPERTY in definition.columns) {
    throw new Error(
      `Entity "${definition.table}" must not define "${ID_PROPERTY}"; it is implicit.`
    );
  }

  const columns: ResolvedColumn[] = [
    {property: ID_PROPERTY, column: "id", type: "uuid", notNull: true, default: "uuidv7()"},
    ...Object.entries(definition.columns).map(([property, column]) => ({
      ...column,
      property,
      column: column.column ?? snakeCase(property)
    }))
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

  return {table: definition.table, columns, indexes, byProperty, byColumn};
}

function resolveIndex(
  table: string,
  index: IndexDefinition,
  byProperty: Map<string, ResolvedColumn>
): ResolvedIndex {
  if (!index.columns?.length && !index.expression) {
    throw new Error(`An index on "${table}" needs columns or an expression.`);
  }

  const columns = index.columns?.map(property => {
    const column = byProperty.get(property);
    if (!column) {
      throw new Error(`Index on "${table}" references unknown property "${property}".`);
    }
    return column.column;
  });

  const unique = index.unique ?? false;
  const name = index.name ?? (columns && `${table}_${columns.join("_")}_${unique ? "key" : "idx"}`);
  if (!name) {
    throw new Error(`An expression index on "${table}" needs a name.`);
  }
  if (name.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(`Index name "${name}" is longer than ${MAX_IDENTIFIER_LENGTH} characters.`);
  }

  return {
    name,
    columns,
    expression: index.expression,
    unique,
    using: index.using ?? "btree",
    where: index.where
  };
}
