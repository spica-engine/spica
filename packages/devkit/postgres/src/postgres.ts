import pg from "pg";

/**
 * **Raw PostgreSQL** access for functions — the PG counterpart of `@spica-devkit/database`.
 *
 * There is **no** neutral intermediate layer and that is deliberate: portability is already provided by
 * the HTTP devkits (`@spica-devkit/bucket` and friends), and the only reason to drop to a raw devkit is
 * native power. A CRUD layer in between would give neither.
 *
 * **The connection given is not the API's connection.** Because raw SQL is executed, a privilege
 * boundary is mandatory: the role has `SELECT/INSERT/UPDATE/DELETE` on `bucket`/`rel` but **no DDL**,
 * read-only on `spica`, and full privileges including DDL on `app`. The API applies the privileges at
 * startup (`compileFunctionGrants`); the role itself is created by the provisioning layer.
 *
 * When the role is not configured this module **refuses explicitly**. Handing over the API's fully
 * privileged connection would be easy, but it is exactly what the privilege boundary prevents: function code
 * would become able to drop bucket tables.
 */

/** Where the function's own tables live. `search_path` is set to it. */
export const APP_SCHEMA = "app";

const POOL_KEY = Symbol.for("kPostgresDevkitPool");

let pool: pg.Pool | undefined = globalThis[POOL_KEY];

process.once("SIGTERM", () => {
  const closing = close();
  closing instanceof Promise ? closing.then(() => process.exit()) : process.exit();
});

function checkEnvironment(): string {
  if (!process.env.RUNTIME) {
    process.emitWarning(
      `Seems like you are not under spica/functions environment.` +
        `This module is only designed to work with spica/functions.`
    );
  }

  const backend = process.env.__INTERNAL__SPICA__DATABASE_BACKEND__;
  if (backend && backend !== "postgres") {
    throw new Error(
      `@spica-devkit/postgres gives raw PostgreSQL access, but this instance runs on '${backend}'. ` +
        `Use @spica-devkit/database for raw access on MongoDB, or @spica-devkit/bucket to stay ` +
        `portable across backends.`
    );
  }

  const uri = process.env.__INTERNAL__SPICA__DATABASE_FUNCTIONS_URI__;
  if (!uri) {
    throw new Error(
      `No database connection is configured for functions. Start the API with ` +
        `--database-functions-uri pointing at a role created for functions; Spica grants that role ` +
        `data access on buckets, read-only access to its own tables and full rights on the '${APP_SCHEMA}' ` +
        `schema. The API's own connection is deliberately not handed to functions: raw SQL with full ` +
        `rights could drop bucket tables.`
    );
  }

  return uri;
}

/**
 * The pool is **one per process**, kept on `globalThis`.
 *
 * A worker runs several calls in the same process; opening a pool per call would mean a new connection
 * on every request. `@spica-devkit/database` keeps its connection there for the same reason.
 */
export function database(): Promise<pg.Pool> {
  let uri: string;
  try {
    uri = checkEnvironment();
  } catch (error) {
    return Promise.reject(error);
  }

  if (!pool) {
    pool = new pg.Pool({
      connectionString: uri,
      application_name: `Functions on ${process.env.RUNTIME || "unknown"} runtime.`
    });

    /**
     * `search_path` is set on every **new connection**: the connections in the pool are independent
     * sessions and a `SET` run once affected only that session. An unqualified table name
     * (`CREATE TABLE notes`) therefore lands in the function's own schema — not in `public`, where it
     * has no privileges anyway.
     */
    pool.on("connect", client => {
      client
        .query(`SET search_path TO ${APP_SCHEMA}`)
        .catch(error =>
          process.emitWarning(
            `Could not set search_path to '${APP_SCHEMA}': ${error.message}. ` +
              `Unqualified table names will not resolve to the function schema.`
          )
        );
    });

    globalThis[POOL_KEY] = pool;
  }

  return Promise.resolve(pool);
}

/** Closes the pool. It is called by itself on `SIGTERM`. */
export function close(): Promise<void> | void {
  if (!pool) return;
  const closing = pool.end();
  pool = undefined;
  globalThis[POOL_KEY] = undefined;
  return closing;
}
