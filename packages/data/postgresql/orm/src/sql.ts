import {Entity, ID_PROPERTY, ResolvedColumn, ResolvedIndex} from "./entity.js";
import {Aggregation, Assignment, Condition, Where, WhereGroup} from "./expressions.js";

export interface Statement {
  text: string;
  values: unknown[];
}

export interface FindOptions<K extends string = string> {
  select?: K[];
  orderBy?: Record<string, "asc" | "desc">;
  limit?: number;
  offset?: number;
  lock?: "update" | "update skip locked";
}

export type Returning = "before" | "after";

export interface UpsertOptions {
  conflict: string[];
  conflictWhere?: string;
  update?: string[];
  set?: Record<string, Assignment>;
}

export const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export function createTableSql(entity: Entity): string {
  const columns = entity.columns.map(column => {
    const parts = [quote(column.column), column.type];
    if (column.property == ID_PROPERTY) {
      parts.push("PRIMARY KEY");
    }
    if (column.notNull) {
      parts.push("NOT NULL");
    }
    if (column.default !== undefined) {
      parts.push(`DEFAULT ${defaultSql(column)}`);
    }
    return parts.join(" ");
  });
  return `CREATE TABLE IF NOT EXISTS ${quote(entity.table)} (${columns.join(", ")})`;
}

const literal = (text: string) => `'${text.replace(/'/g, "''")}'`;

function defaultSql(column: ResolvedColumn) {
  const value = column.default;
  if (value === "") {
    throw new Error(
      `"${column.property}" cannot default to an empty string; write "''" for an empty text.`
    );
  }
  if (typeof value == "string") {
    return value;
  }
  if (typeof value == "number" || typeof value == "boolean") {
    return String(value);
  }
  if (column.type == "jsonb") {
    return `${literal(JSON.stringify(value))}::jsonb`;
  }
  if (Array.isArray(value) && column.type.endsWith("[]") && !value.length) {
    return "'{}'";
  }
  throw new Error(`"${column.property}" cannot default to ${JSON.stringify(value)}.`);
}

export function createIndexSql(entity: Entity, index: ResolvedIndex): string {
  const target = index.expression ?? index.columns.map(quote).join(", ");
  const parts = [
    "CREATE",
    index.unique ? "UNIQUE" : "",
    "INDEX IF NOT EXISTS",
    quote(index.name),
    "ON",
    quote(entity.table),
    `USING ${index.using}`,
    `(${target})`,
    index.where ? `WHERE ${index.where}` : ""
  ];
  return parts.filter(Boolean).join(" ");
}

export function toDbValue(column: ResolvedColumn, value: unknown) {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Condition || value instanceof Assignment || value instanceof WhereGroup) {
    throw new Error(`"${column.property}" cannot store an expression.`);
  }
  return column.type == "jsonb" ? JSON.stringify(value) : value;
}

export function fromRow<R>(entity: Entity<R>, row: Record<string, unknown>): R {
  const record: Record<string, unknown> = {};
  for (const column of entity.columns) {
    const value = row[column.column];
    if (value !== null && value !== undefined) {
      record[column.property] = value;
    }
  }
  return record as R;
}

function columnOf(entity: Entity, property: string) {
  const column = entity.byProperty.get(property);
  if (!column) {
    throw new Error(`"${entity.table}" has no property "${property}".`);
  }
  return column;
}

function presentColumns(entity: Entity, record: Record<string, unknown>) {
  return Object.keys(record)
    .filter(property => record[property] !== undefined)
    .map(property => columnOf(entity, property));
}

function predicate(entity: Entity, where: Where, values: unknown[]): string {
  if (where instanceof WhereGroup) {
    if (!where.parts.length) {
      return where.operator == "AND" ? "TRUE" : "FALSE";
    }
    return `(${where.parts.map(part => `(${predicate(entity, part, values)})`).join(` ${where.operator} `)})`;
  }

  const conditions = Object.entries(where).map(([property, value]) => {
    const column = columnOf(entity, property);
    if (value === undefined) {
      throw new Error(
        `"${entity.table}" was queried with an undefined "${property}"; use null to match NULL.`
      );
    }
    if (value instanceof WhereGroup) {
      throw new Error(
        `"${entity.table}.${property}" was given a group; put the property inside and(...) or or(...) instead.`
      );
    }
    if (value instanceof Condition) {
      return value.sql(quote(column.column), column, values);
    }
    if (value === null) {
      return `${quote(column.column)} IS NULL`;
    }
    if (Array.isArray(value) && !column.type.endsWith("[]")) {
      if (!value.length) {
        return "FALSE";
      }
      values.push(value.map(item => toDbValue(column, item)));
      return `${quote(column.column)} = ANY($${values.length})`;
    }
    values.push(toDbValue(column, value));
    return `${quote(column.column)} = $${values.length}`;
  });
  return conditions.length ? conditions.join(" AND ") : "TRUE";
}

function whereSql(entity: Entity, where: Where, values: unknown[]) {
  const text = predicate(entity, where, values);
  return text == "TRUE" ? "" : ` WHERE ${text}`;
}

function jsonPath(entity: Entity, property: string, values: unknown[]) {
  const [root, ...path] = property.split(".");
  const column = columnOf(entity, root);
  if (!path.length) {
    return {column, expression: quote(column.column)};
  }
  if (column.type != "jsonb") {
    throw new Error(`"${entity.table}.${root}" is not a jsonb column.`);
  }
  values.push(path);
  return {column, expression: `(${quote(column.column)} #> $${values.length}::text[])`};
}

function returningSql(returning: Returning) {
  return returning == "before" ? "RETURNING old.*" : "RETURNING *";
}

export function changedColumns(entity: Entity, id: unknown, changes: Record<string, unknown>) {
  if (changes[ID_PROPERTY] !== undefined && String(changes[ID_PROPERTY]) != String(id)) {
    throw new Error(`The id of a "${entity.table}" record cannot be changed.`);
  }
  return presentColumns(entity, changes).filter(column => column.property != ID_PROPERTY);
}

export function insertSql(entity: Entity, record: Record<string, unknown>): Statement {
  const columns = presentColumns(entity, record);
  if (!columns.length) {
    return {text: `INSERT INTO ${quote(entity.table)} DEFAULT VALUES RETURNING *`, values: []};
  }
  return {
    text: `INSERT INTO ${quote(entity.table)} (${columns.map(c => quote(c.column)).join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
    values: columns.map(column => toDbValue(column, record[column.property]))
  };
}

export function insertManySql(entity: Entity, records: Record<string, unknown>[]): Statement {
  const properties = new Set(
    records.flatMap(record => presentColumns(entity, record).map(c => c.property))
  );
  const columns = properties.size
    ? [...properties].map(property => columnOf(entity, property))
    : [columnOf(entity, ID_PROPERTY)];

  const values: unknown[] = [];
  const rows = records.map(record => {
    const placeholders = columns.map(column => {
      const value = record[column.property];
      if (value === undefined) {
        return "DEFAULT";
      }
      values.push(toDbValue(column, value));
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  return {
    text: `INSERT INTO ${quote(entity.table)} (${columns.map(c => quote(c.column)).join(", ")}) VALUES ${rows.join(", ")} RETURNING *`,
    values
  };
}

export function updateSql(
  entity: Entity,
  id: unknown,
  changes: Record<string, unknown>,
  returning: Returning
): Statement {
  const columns = changedColumns(entity, id, changes);
  if (!columns.length) {
    throw new Error(`Nothing to update on "${entity.table}".`);
  }
  const values: unknown[] = [];
  const assignments = columns.map(column => {
    const value = changes[column.property];
    const target = `${quote(entity.table)}.${quote(column.column)}`;
    if (value instanceof Assignment) {
      return `${quote(column.column)} = ${value.sql(target, column, values)}`;
    }
    values.push(toDbValue(column, value));
    return `${quote(column.column)} = $${values.length}`;
  });
  const condition = whereSql(entity, {[ID_PROPERTY]: id}, values);
  return {
    text: `UPDATE ${quote(entity.table)} SET ${assignments.join(", ")}${condition} ${returningSql(returning)}`,
    values
  };
}

export function replaceSql(
  entity: Entity,
  id: unknown,
  record: Record<string, unknown>,
  returning: Returning
): Statement {
  const values: unknown[] = [];
  const assignments = entity.columns
    .filter(column => column.property != ID_PROPERTY)
    .map(column => {
      const value = record[column.property];
      if (value === undefined) {
        return `${quote(column.column)} = DEFAULT`;
      }
      values.push(toDbValue(column, value));
      return `${quote(column.column)} = $${values.length}`;
    });
  const condition = whereSql(entity, {[ID_PROPERTY]: id}, values);
  return {
    text: `UPDATE ${quote(entity.table)} SET ${assignments.join(", ")}${condition} ${returningSql(returning)}`,
    values
  };
}

export function deleteSql(entity: Entity, where: Where, returning = true): Statement {
  const values: unknown[] = [];
  const condition = whereSql(entity, where, values);
  return {
    text: `DELETE FROM ${quote(entity.table)}${condition}${returning ? " RETURNING *" : ""}`,
    values
  };
}

export function selectSql(entity: Entity, where: Where, options: FindOptions = {}): Statement {
  const values: unknown[] = [];
  const projection = options.select
    ? options.select.map(property => quote(columnOf(entity, property).column)).join(", ")
    : "*";
  let text = `SELECT ${projection} FROM ${quote(entity.table)}${whereSql(entity, where, values)}`;
  if (options.orderBy) {
    const order = Object.entries(options.orderBy).map(
      ([property, direction]) =>
        `${jsonPath(entity, property, values).expression} ${direction == "desc" ? "DESC" : "ASC"}`
    );
    text += ` ORDER BY ${order.join(", ")}`;
  }
  if (options.limit !== undefined) {
    values.push(options.limit);
    text += ` LIMIT $${values.length}`;
  }
  if (options.offset !== undefined) {
    values.push(options.offset);
    text += ` OFFSET $${values.length}`;
  }
  if (options.lock) {
    text += options.lock == "update" ? " FOR UPDATE" : " FOR UPDATE SKIP LOCKED";
  }
  return {text, values};
}

export function aggregateSql(
  entity: Entity,
  aggregations: Record<string, Aggregation>,
  where: Where
): Statement {
  if (!Object.keys(aggregations).length) {
    throw new Error(`An aggregate on "${entity.table}" needs at least one aggregation.`);
  }
  const values: unknown[] = [];
  const columns = Object.entries(aggregations).map(([alias, {property}]) => {
    const [root, ...path] = property.split(".");
    const column = columnOf(entity, root);
    let source = quote(column.column);
    if (path.length) {
      values.push(path);
      source = `(${source} #>> $${values.length}::text[])`;
    }
    return `COALESCE(SUM(${source}::float8), 0) AS ${quote(alias)}`;
  });
  return {
    text: `SELECT ${columns.join(", ")} FROM ${quote(entity.table)}${whereSql(entity, where, values)}`,
    values
  };
}

export function countSql(entity: Entity, where: Where): Statement {
  const values: unknown[] = [];
  return {
    text: `SELECT count(*) AS count FROM ${quote(entity.table)}${whereSql(entity, where, values)}`,
    values
  };
}

export function upsertSql(
  entity: Entity,
  record: Record<string, unknown>,
  options: UpsertOptions
): Statement {
  if (!options.conflict.length) {
    throw new Error(`An upsert on "${entity.table}" needs at least one conflict property.`);
  }
  const absent = options.update?.find(property => record[property] === undefined);
  if (absent) {
    throw new Error(`An upsert on "${entity.table}" updates "${absent}" but the record omits it.`);
  }
  const insert = insertSql(entity, record);
  const conflict = options.conflict.map(property => quote(columnOf(entity, property).column));
  const set = Object.entries(options.set ?? {});
  const setProperties = set.map(([property]) => property);
  const updated = (options.update ?? presentColumns(entity, record).map(c => c.property))
    .filter(
      property =>
        property != ID_PROPERTY &&
        !options.conflict.includes(property) &&
        !setProperties.includes(property)
    )
    .map(property => quote(columnOf(entity, property).column));
  const values = [...insert.values];
  const assignments = [
    ...updated.map(column => `${column} = EXCLUDED.${column}`),
    ...set.map(([property, assignment]) => {
      const column = columnOf(entity, property);
      const target = `${quote(entity.table)}.${quote(column.column)}`;
      return `${quote(column.column)} = ${assignment.sql(target, column, values)}`;
    })
  ];

  const target = `ON CONFLICT (${conflict.join(", ")})${options.conflictWhere ? ` WHERE ${options.conflictWhere}` : ""}`;
  const action = assignments.length ? `DO UPDATE SET ${assignments.join(", ")}` : "DO NOTHING";

  return {
    text: insert.text.replace(/ RETURNING \*$/, ` ${target} ${action} RETURNING *`),
    values
  };
}
