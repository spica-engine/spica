import {SqlFragment} from "../compiler/expression-to-sql.js";
import {APP_SCHEMA, BUCKET_SCHEMA, RELATION_SCHEMA, SYSTEM_SCHEMA} from "../schema/naming.js";

/**
 * The privileges of the PostgreSQL role given to functions.
 *
 * `@spica-devkit/postgres` hands over **raw SQL**, so function code writes to the database directly.
 * the privilege boundary is mandatory for that reason:
 *
 * | Schema     | The function's role                                    |
 * | ---------- | ------------------------------------------------------ |
 * | `bucket.*` | `SELECT/INSERT/UPDATE/DELETE` ✓ · **DDL ✗**            |
 * | `spica.*`  | read only                                              |
 * | `app.*`    | full privileges, DDL included (the function's own tables) |
 *
 * **Spica does not create the role, it only grants to it.** `CREATE ROLE` requires `CREATEROLE` and that
 * is **not** in the privilege list we ask for at startup (see `privileges.ts`: neither `REPLICATION` nor
 * superuser is needed). The provisioning layer creates the role; Spica takes its URI and applies the
 * `GRANT`s — owning the schema is enough for a `GRANT`.
 *
 * **How DDL on `bucket.*` is prevented:** `CREATE` on the schema is **not granted**. `USAGE` is enough to
 * see the tables; without `CREATE` no new table can be created, and dropping an existing table requires
 * ownership, which the role does not have. So the DDL path is closed from two directions.
 *
 * `ALTER DEFAULT PRIVILEGES` is necessary: bucket tables are created **at runtime**, so a table that does
 * not exist today has to have been granted as well. Without it every new bucket was invisible to
 * functions.
 */
export function compileFunctionGrants(role: string): SqlFragment[] {
  const r = quoteIdentifier(role);

  return [
    // bucket: reading and writing data, no DDL (CREATE on the schema is not granted).
    {sql: `GRANT USAGE ON SCHEMA ${BUCKET_SCHEMA} TO ${r}`, params: []},
    {
      sql: `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${BUCKET_SCHEMA} TO ${r}`,
      params: []
    },
    {
      sql:
        `ALTER DEFAULT PRIVILEGES IN SCHEMA ${BUCKET_SCHEMA} ` +
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${r}`,
      params: []
    },

    // rel: the namespace reserved for relation junction tables; there is no table today, but the privileges match bucket.
    {sql: `GRANT USAGE ON SCHEMA ${RELATION_SCHEMA} TO ${r}`, params: []},
    {
      sql: `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${RELATION_SCHEMA} TO ${r}`,
      params: []
    },
    {
      sql:
        `ALTER DEFAULT PRIVILEGES IN SCHEMA ${RELATION_SCHEMA} ` +
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${r}`,
      params: []
    },

    // spica: **read only**. The system tables are Spica's own state; a function writing to them would
    // mean changing an identity, an apikey or a bucket definition while bypassing the API.
    {sql: `GRANT USAGE ON SCHEMA ${SYSTEM_SCHEMA} TO ${r}`, params: []},
    {sql: `GRANT SELECT ON ALL TABLES IN SCHEMA ${SYSTEM_SCHEMA} TO ${r}`, params: []},
    {
      sql: `ALTER DEFAULT PRIVILEGES IN SCHEMA ${SYSTEM_SCHEMA} GRANT SELECT ON TABLES TO ${r}`,
      params: []
    },

    // app: the function's own space — full privileges, DDL included.
    {sql: `GRANT USAGE, CREATE ON SCHEMA ${APP_SCHEMA} TO ${r}`, params: []},
    {sql: `GRANT ALL ON ALL TABLES IN SCHEMA ${APP_SCHEMA} TO ${r}`, params: []},
    {sql: `GRANT ALL ON ALL SEQUENCES IN SCHEMA ${APP_SCHEMA} TO ${r}`, params: []},
    {
      sql: `ALTER DEFAULT PRIVILEGES IN SCHEMA ${APP_SCHEMA} GRANT ALL ON TABLES TO ${r}`,
      params: []
    },
    {
      sql: `ALTER DEFAULT PRIVILEGES IN SCHEMA ${APP_SCHEMA} GRANT ALL ON SEQUENCES TO ${r}`,
      params: []
    }
  ];
}

/**
 * A role name **cannot be bound as a parameter**: `GRANT` is a DDL statement and a role name is an
 * identifier, not a value. So it is quoted and any `"` inside it is doubled — PostgreSQL's identifier
 * rule. Without quoting, a name coming from a URI would go straight into the SQL.
 */
export function quoteIdentifier(name: string): string {
  if (!name || !/^[^\0]+$/.test(name)) {
    throw new Error(`'${name}' is not a usable PostgreSQL role name.`);
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/** The role name from the function connection URI; `undefined` when there is no user name. */
export function roleFromUri(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  try {
    const username = new URL(uri).username;
    return username ? decodeURIComponent(username) : undefined;
  } catch {
    return undefined;
  }
}
