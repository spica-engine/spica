import {ColumnKind, ColumnSpec, TableSpec} from "@spica-server/database-driver";
import {SqlFragment} from "./expression-to-sql.js";
import {APP_SCHEMA, BUCKET_SCHEMA, RELATION_SCHEMA, SYSTEM_SCHEMA} from "../schema/naming.js";

/**
 * `TableSpec` → `CREATE TABLE` (Phase 3's DDL surface).
 *
 * Phase 4's DDL planner will produce `ALTER`; this one only creates a table from scratch. Both are
 * consistent because both read the same `TableSpec`: K-12's intent → derivative direction is fed from a
 * single source.
 *
 * **No `NOT NULL`** (K-7's safety rule): `required` validation stays in the API's JSON Schema validator,
 * and on the DB side a `SET NOT NULL` would mean a full table scan.
 */
export function compileCreateTable(table: TableSpec): SqlFragment[] {
  // System tables live in the `spica` schema, bucket data in `bucket` (AK-8).
  const schema = table.namespace || BUCKET_SCHEMA;
  const statements: SqlFragment[] = [];

  const columns = [
    // `idKind` is for ids that are not ObjectIds (replication's `jobs`/`commands` tables).
    `"_id" ${table.idKind === "text" ? "text" : "char(24)"} PRIMARY KEY`,
    ...table.columns.map(column => `"${column.name}" ${sqlType(column)}`)
  ];

  statements.push({
    sql:
      `CREATE TABLE IF NOT EXISTS ${schema}."${table.collection}" (\n` +
      columns.map(line => `  ${line}`).join(",\n") +
      `\n)`,
    params: []
  });

  // The onetoone FKs are separate statements: the target table may not have been created yet (K-7's ordering).
  for (const column of table.columns) {
    if (column.kind !== "reference" || !column.target) continue;
    statements.push({
      sql:
        `ALTER TABLE ${schema}."${table.collection}" ` +
        `ADD CONSTRAINT "${table.collection}_${column.name}_fk" ` +
        `FOREIGN KEY ("${column.name}") REFERENCES ${BUCKET_SCHEMA}."${column.target}"("_id")` +
        (column.cascadeOnDelete ? " ON DELETE CASCADE" : " ON DELETE SET NULL"),
      params: []
    });
  }

  return statements;
}

/** Creates the schemas; the bootstrap the driver runs once at startup. */
/**
 * Four namespaces, four different privilege boundaries (K-11):
 * `bucket` is tenant data, `rel` the junction tables, `spica` the system tables, `app` the functions' own
 * tables — DDL privileges exist only on `app`.
 */
export function compileCreateSchemas(): SqlFragment[] {
  return [BUCKET_SCHEMA, RELATION_SCHEMA, SYSTEM_SCHEMA, APP_SCHEMA].map(schema => ({
    sql: `CREATE SCHEMA IF NOT EXISTS "${schema}"`,
    params: []
  }));
}

export function sqlType(column: ColumnSpec): string {
  // The `json` columns whose key order is meaningful are not turned into `jsonb`; the rationale is in `ColumnSpec`.
  if (column.kind === "json" && column.orderedJson) return "json";
  return columnKindToSqlType(column.kind);
}

export function columnKindToSqlType(kind: ColumnKind): string {
  switch (kind) {
    case "text":
      return "text";
    case "number":
      return "double precision";
    case "boolean":
      return "boolean";
    case "timestamp":
      return "timestamptz";
    case "json":
      return "jsonb";
    case "textArray":
      return "text[]";
    case "numberArray":
      return "double precision[]";
    case "reference":
      return "char(24)";
    // K-14: PostGIS is not mandatory; GeoJSON is stored as `jsonb`.
    case "location":
      return "jsonb";
    case "bytes":
      return "bytea";
    default: {
      const exhaustive: never = kind;
      throw new Error(`unmapped column kind '${exhaustive}'`);
    }
  }
}
