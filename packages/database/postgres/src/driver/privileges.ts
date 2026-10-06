import {APP_SCHEMA, BUCKET_SCHEMA, RELATION_SCHEMA, SYSTEM_SCHEMA} from "../schema/naming.js";

/**
 * Checking the database privileges at startup.
 *
 * **Why it is needed.** Spica's PostgreSQL user performs DDL at runtime: bucket tables, triggers,
 * indexes, schema evolution. When a privilege is missing the error appears **at use time** and far away
 * — a bucket creation request returns a 500 with `permission denied for schema bucket` and the user
 * cannot see that this is a configuration problem. Checking at startup reports the gap at installation
 * time and **by name**.
 *
 * Neither `REPLICATION` nor superuser is **required**: CDC works with a trigger plus an outbox and
 * logical decoding is not used. The check documents that too — the privilege list asked for is exactly
 * this.
 */
export class MissingPrivilegeError extends Error {
  constructor(readonly missing: string[]) {
    super(
      `The PostgreSQL role is missing privileges required to run Spica: ${missing.join(", ")}. ` +
        `Grant them and restart. Spica needs CREATE on the database (to create its schemas), then ` +
        `USAGE and CREATE on each of its schemas; REPLICATION and superuser are not needed.`
    );
  }
}

/** The only privilege checked **before** the schemas are created: being able to create them. */
export const DATABASE_CREATE_CHECK =
  "SELECT has_database_privilege(current_database(), 'CREATE') AS allowed";

const SCHEMAS = [BUCKET_SCHEMA, RELATION_SCHEMA, SYSTEM_SCHEMA, APP_SCHEMA];

/**
 * The privileges checked **after** the schemas are created.
 *
 * The order matters: `has_schema_privilege` raises on a schema that does not exist, so this check runs
 * after the schemas are set up. The database-level `CREATE`, on the other hand, is checked before that —
 * otherwise the user saw the raw error from `CREATE SCHEMA`.
 */
export function schemaPrivilegeCheck(): string {
  const columns = SCHEMAS.flatMap(schema => [
    `has_schema_privilege('${schema}', 'USAGE') AS "${schema}_usage"`,
    `has_schema_privilege('${schema}', 'CREATE') AS "${schema}_create"`
  ]);
  return `SELECT ${columns.join(", ")}`;
}

/** Turns the check's result into the names of the missing privileges; an empty array means "everything is in place". */
export function missingSchemaPrivileges(row: Record<string, boolean>): string[] {
  const missing: string[] = [];
  for (const schema of SCHEMAS) {
    if (!row[`${schema}_usage`]) missing.push(`USAGE on schema ${schema}`);
    if (!row[`${schema}_create`]) missing.push(`CREATE on schema ${schema}`);
  }
  return missing;
}
