import {
  CreateIndexOptions,
  IndexSpec,
  TableSpec,
  UnsupportedCapabilityError
} from "@spica-server/database-driver";
import {SqlFragment} from "./expression-to-sql.js";
import {compileCrudFilter} from "./crud-filter-to-sql.js";
import {BUCKET_SCHEMA} from "../schema/naming.js";

/**
 * An index definition → `CREATE INDEX`. An option with no counterpart raises rather than being ignored:
 * ignoring it means the index the user thinks they created does not exist.
 */
export function compileCreateIndex(
  table: TableSpec,
  spec: IndexSpec,
  options: CreateIndexOptions = {}
): SqlFragment {
  assertSupported(options);

  if (!spec.keys.length) {
    throw new UnsupportedCapabilityError("an index without keys", "postgres");
  }

  const known = new Set(table.columns.map(column => column.name));
  const params: unknown[] = [];

  /**
   * GIN carries **no ordering options** — `USING gin ("tags" ASC)` is rejected by the server — and nothing is
   * lost by dropping the direction, because a GIN index is unordered to begin with.
   */
  const gin = usingClause(table, spec) === "USING gin";

  const keys = spec.keys.map(({field, direction}) => {
    /**
     * The contract's `IndexDirection` is `1 | -1`, but MongoDB also accepts `text`/`2dsphere`/`2d`/`hashed`
     * as strings. Read as "not -1" they would silently become a plain btree index, and the API is reachable
     * without the panel that hides them.
     */
    if (direction !== 1 && direction !== -1) {
      throw new UnsupportedCapabilityError(
        `index kind '${direction}' on '${field}' (only ascending and descending exist here)`,
        "postgres"
      );
    }

    const order = direction === -1 ? "DESC" : "ASC";

    if (field === "_id" || known.has(field)) {
      // The order comes from the array representation: in a compound index it is meaningful.
      return gin ? `"${field}"` : `"${field}" ${order}`;
    }

    /**
     * A nested path (`email.hash`) → an **expression index** `((email->>'hash'))`, which is how a unique index
     * on a jsonb field's `hash` is expressed; a plain column lookup would not find it and a duplicate e-mail
     * would be accepted. The root column has to be `json`, or `->>` is meaningless.
     */
    const [root, ...rest] = field.split(".");
    if (rest.length && known.has(root)) {
      const kind = table.columns.find(column => column.name === root)?.kind;
      if (kind !== "json") {
        throw new UnsupportedCapabilityError(
          `an index on nested path '${field}' where '${root}' is '${kind}', not json`,
          "postgres"
        );
      }
      const head = rest
        .slice(0, -1)
        .map(segment => `->'${segment}'`)
        .join("");
      return `(("${root}"${head}->>'${rest[rest.length - 1]}')) ${order}`;
    }

    throw new UnsupportedCapabilityError(
      `an index on '${field}', which is not a property of this bucket`,
      "postgres"
    );
  });

  const parts = [
    "CREATE",
    options.unique ? "UNIQUE" : "",
    /**
     * `IF NOT EXISTS`, because Mongo's `createIndex` is idempotent and the callers rely on it: `afterInit`
     * runs per collection instance, so the same index is requested dozens of times per process.
     *
     * PostgreSQL makes a **name mandatory** for `IF NOT EXISTS`, so one is derived when none is given — the
     * unnamed path needs the protection just as much.
     */
    `INDEX IF NOT EXISTS "${spec.name || deriveIndexName(spec)}"`,
    // System tables live in the `spica` schema; when no `namespace` is given, bucket data is assumed.
    `ON ${table.namespace || BUCKET_SCHEMA}."${table.collection}"`,
    usingClause(table, spec),
    `(${keys.join(", ")})`
  ];

  /**
   * `sparse` → `WHERE "column" IS NOT NULL`: "the field is absent" maps exactly to `NULL` here, which is this
   * driver's own rule, so a partial index gives the same thing.
   *
   * A compound `sparse` is rejected: Mongo skips when **all** the keys are missing and there is no
   * single-column counterpart for that.
   */
  if (options.sparse) {
    if (spec.keys.length !== 1) {
      throw new UnsupportedCapabilityError("a compound sparse index", "postgres");
    }
    parts.push(`WHERE "${spec.keys[0].field}" IS NOT NULL`);
  }

  if (options.partialFilterExpression) {
    /**
     * A partial index: Mongo's `partialFilterExpression` is a `WHERE` clause in PostgreSQL.
     *
     * **Raw Mongo JSON is accepted.** The earlier comment said "it has to be a CEL AST", but the
     * measurement showed the opposite: the single caller (`passport/user/src/user.service.ts`) supplies
     * Mongo JSON (`{"email.hash": {$exists: true}}`). This is an **internal** surface — the code writes
     * it, not a user — so, it has a finite compiler: `compileCrudFilter`.
     */
    const fragment = compileCrudFilter(options.partialFilterExpression as any, {
      table,
      paramOffset: params.length
    });
    params.push(...fragment.params);
    parts.push(`WHERE ${fragment.sql}`);
  }

  return {sql: parts.filter(Boolean).join(" "), params};
}

/**
 * GIN is used on array columns: the `&&` and `@>` operators (that is, the `some`/`every` builtins) can
 * only benefit from an index with GIN. Step S measured a `Bitmap Index Scan` being chosen on a selective
 * tag.
 */
function usingClause(table: TableSpec, spec: IndexSpec): string {
  if (spec.keys.length !== 1) return "";
  const column = table.columns.find(c => c.name === spec.keys[0].field);
  if (!column) return "";
  return column.kind === "textArray" || column.kind === "numberArray" ? "USING gin" : "";
}

function assertSupported(options: CreateIndexOptions): void {
  if (options.collation) {
    throw new UnsupportedCapabilityError("index option 'collation'", "postgres");
  }
  if (options.expireAfterSeconds !== undefined) {
    // There is no TTL index; it is served by the sweeper (the capability declaration: nativeTTLIndex: false).
    throw new UnsupportedCapabilityError("TTL indexes (expireAfterSeconds)", "postgres");
  }
}

/**
 * `DROP INDEX` — schema qualified, and it does not stay silent on an index that does not exist.
 *
 * `namespace` is needed for system tables: an index lives in the same schema as its table.
 */
export function compileDropIndex(name: string, namespace = BUCKET_SCHEMA): SqlFragment {
  return {sql: `DROP INDEX ${namespace}."${name}"`, params: []};
}

/**
 * A deterministic name for an unnamed index.
 *
 * The pattern is the same as the one Spica produces itself (`bucket.service.ts:generateIndexName`):
 * `field_direction` pairs joined with `_`. Being deterministic is essential — `IF NOT EXISTS` only
 * protects anything if the same index gets the same name on every call.
 *
 * Dots in nested paths become `_`: a dot is not a problem in a PostgreSQL identifier but it hurts
 * readability, and `email.hash_1` looks like a schema qualification.
 */
export function deriveIndexName(spec: IndexSpec): string {
  return spec.keys
    .map(({field, direction}) => `${field.replace(/\./g, "_")}_${direction}`)
    .join("_");
}
