import {Entity, ID_PROPERTY, ResolvedColumn, ResolvedIndex} from "./entity.js";

export interface Statement {
  text: string;
  values: unknown[];
}

export type Where = Record<string, unknown>;

export interface FindOptions {
  orderBy?: Record<string, "asc" | "desc">;
  limit?: number;
  offset?: number;
}

export type Returning = "before" | "after";

export interface UpsertOptions {
  conflict: string[];
  conflictWhere?: string;
  update?: string[];
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
    if (column.default) {
      parts.push(`DEFAULT ${column.default}`);
    }
    return parts.join(" ");
  });
  return `CREATE TABLE IF NOT EXISTS ${quote(entity.table)} (${columns.join(", ")})`;
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
  const converted = column.toDb ? column.toDb(value) : value;
  return column.type == "jsonb" ? JSON.stringify(converted) : converted;
}

export function fromRow<R>(entity: Entity<R>, row: Record<string, unknown>): R {
  const record: Record<string, unknown> = {};
  for (const column of entity.columns) {
    const value = row[column.column];
    if (value !== null && value !== undefined) {
      record[column.property] = column.fromDb ? column.fromDb(value) : value;
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

function whereSql(entity: Entity, where: Where, values: unknown[]) {
  const conditions = Object.entries(where).map(([property, value]) => {
    const column = columnOf(entity, property);
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
  return conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
}

function returningSql(returning: Returning) {
  return returning == "before" ? "RETURNING old.*" : "RETURNING *";
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
  const columns = presentColumns(entity, changes).filter(column => column.property != ID_PROPERTY);
  if (!columns.length) {
    throw new Error(`Nothing to update on "${entity.table}".`);
  }
  const values = columns.map(column => toDbValue(column, changes[column.property]));
  const assignments = columns.map((column, index) => `${quote(column.column)} = $${index + 1}`);
  values.push(id);
  return {
    text: `UPDATE ${quote(entity.table)} SET ${assignments.join(", ")} WHERE "id" = $${values.length} ${returningSql(returning)}`,
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
  values.push(id);
  return {
    text: `UPDATE ${quote(entity.table)} SET ${assignments.join(", ")} WHERE "id" = $${values.length} ${returningSql(returning)}`,
    values
  };
}

export function deleteSql(entity: Entity, where: Where): Statement {
  const values: unknown[] = [];
  const condition = whereSql(entity, where, values);
  return {text: `DELETE FROM ${quote(entity.table)}${condition} RETURNING *`, values};
}

export function selectSql(entity: Entity, where: Where, options: FindOptions = {}): Statement {
  const values: unknown[] = [];
  let text = `SELECT * FROM ${quote(entity.table)}${whereSql(entity, where, values)}`;
  if (options.orderBy) {
    const order = Object.entries(options.orderBy).map(
      ([property, direction]) =>
        `${quote(columnOf(entity, property).column)} ${direction == "desc" ? "DESC" : "ASC"}`
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
  return {text, values};
}

export function countSql(entity: Entity, where: Where): Statement {
  const values: unknown[] = [];
  return {
    text: `SELECT count(*)::int AS count FROM ${quote(entity.table)}${whereSql(entity, where, values)}`,
    values
  };
}

export function upsertSql(
  entity: Entity,
  record: Record<string, unknown>,
  options: UpsertOptions
): Statement {
  const insert = insertSql(entity, record);
  const conflict = options.conflict.map(property => quote(columnOf(entity, property).column));
  const updated = (options.update ?? presentColumns(entity, record).map(c => c.property))
    .filter(property => property != ID_PROPERTY && !options.conflict.includes(property))
    .map(property => quote(columnOf(entity, property).column));

  const target = `ON CONFLICT (${conflict.join(", ")})${options.conflictWhere ? ` WHERE ${options.conflictWhere}` : ""}`;
  const action = updated.length
    ? `DO UPDATE SET ${updated.map(column => `${column} = EXCLUDED.${column}`).join(", ")}`
    : "DO NOTHING";

  return {
    text: insert.text.replace(/ RETURNING \*$/, ` ${target} ${action} RETURNING *`),
    values: insert.values
  };
}
