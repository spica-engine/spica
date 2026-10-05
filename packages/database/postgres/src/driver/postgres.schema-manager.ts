import {
  ColumnSpec,
  ISchemaManager,
  SchemaChange,
  SchemaDrift,
  SchemaLockTimeoutError,
  SchemaPlan,
  SchemaPlanHints,
  TableSpec
} from "@spica-server/database-driver";
import {compileCreateTable} from "../compiler/table-to-sql.js";
import {sqlType, columnKindToSqlType} from "../compiler/table-to-sql.js";
import {BUCKET_SCHEMA, SYSTEM_SCHEMA} from "../schema/naming.js";
import {Queryable} from "./postgres.collection.js";

export interface TransactionRunner {
  transaction<R>(work: (client: Queryable) => Promise<R>): Promise<R>;
}

export interface SchemaManagerOptions {
  /** The lock wait time; so that writes are not blocked behind a long-running `SELECT`. */
  lockTimeout?: string;
  /** How many times to retry when the lock cannot be taken. */
  maxAttempts?: number;
  /**
   * Above this estimated row count a **rewriting** type change is reported as long running and the panel warns.
   * The rewrite is linear at roughly 1.8 µs per row, and the default is the first size where the pause is
   * visible — warning only at the `lockTimeout` ceiling would make the user's first notice a failed migration.
   */
  rewriteThreshold?: number;
}

/** The PostgreSQL implementation of `ISchemaManager`. */
export class PostgresSchemaManager implements ISchemaManager {
  private options: Required<SchemaManagerOptions>;

  constructor(
    private db: Queryable,
    private runner: TransactionRunner,
    options: SchemaManagerOptions = {}
  ) {
    this.options = {
      lockTimeout: options.lockTimeout ?? "3s",
      maxAttempts: options.maxAttempts ?? 3,
      rewriteThreshold: options.rewriteThreshold ?? 100_000
    };
  }

  /** Creates the system tables; once, at startup. */
  async bootstrap(): Promise<void> {
    await this.db.query(`CREATE SCHEMA IF NOT EXISTS "${SYSTEM_SCHEMA}"`);
    await this.db.query(
      `CREATE TABLE IF NOT EXISTS ${SYSTEM_SCHEMA}."bucket_schema_changes" (
         "id" bigserial PRIMARY KEY,
         "bucket_id" text NOT NULL,
         "sql" text NOT NULL,
         "applied_at" timestamptz NOT NULL DEFAULT now()
       )`
    );
    await this.db.query(DEEP_UNSET_FUNCTION);
  }

  async ensure(spec: TableSpec): Promise<void> {
    for (const statement of compileCreateTable(spec)) {
      await this.db.query(statement.sql, statement.params);
    }
  }

  async plan(from: TableSpec, to: TableSpec, hints: SchemaPlanHints = {}): Promise<SchemaPlan> {
    const renames = new Map((hints.renames || []).map(r => [r.from, r.to]));
    const before = new Map(from.columns.map(c => [c.name, c]));
    const after = new Map(to.columns.map(c => [c.name, c]));

    const changes: SchemaChange[] = [];
    const statements: string[] = [];
    let requiresRewrite = false;
    const table = `${BUCKET_SCHEMA}."${to.collection}"`;

    // 1) Renames FIRST: so that the later comparisons see the new name.
    for (const [oldName, newName] of renames) {
      const column = before.get(oldName);
      if (!column || after.has(oldName)) continue;
      changes.push({kind: "renameColumn", column: oldName, to: newName});
      statements.push(`ALTER TABLE ${table} RENAME COLUMN "${oldName}" TO "${newName}"`);
      before.delete(oldName);
      before.set(newName, {...column, name: newName});
    }

    // 2) Additions — NO volatile DEFAULT, NO NOT NULL (the safety rules).
    for (const [name, column] of after) {
      if (before.has(name)) continue;
      changes.push({kind: "addColumn", column: name, spec: column});
      statements.push(`ALTER TABLE ${table} ADD COLUMN "${name}" ${sqlType(column)}`);
      if (column.kind === "reference" && column.target) {
        statements.push(
          `ALTER TABLE ${table} ADD CONSTRAINT "${to.collection}_${name}_fk" ` +
            `FOREIGN KEY ("${name}") REFERENCES ${BUCKET_SCHEMA}."${column.target}"("_id") ` +
            (column.cascadeOnDelete ? "ON DELETE CASCADE" : "ON DELETE SET NULL")
        );
      }
    }

    // 3) Type changes — the rewrite risk is here.
    for (const [name, column] of after) {
      const previous = before.get(name);
      if (!previous || previous.kind === column.kind) continue;
      changes.push({kind: "changeColumnType", column: name, spec: column});

      // `clearOnTypeChange`: clearing rather than converting — the rationale is in `SchemaPlanHints`.
      if (hints.clearOnTypeChange) {
        statements.push(`ALTER TABLE ${table} DROP COLUMN "${name}"`);
        statements.push(`ALTER TABLE ${table} ADD COLUMN "${name}" ${sqlType(column)}`);
      } else {
        statements.push(
          `ALTER TABLE ${table} ALTER COLUMN "${name}" TYPE ${sqlType(column)} ` +
            `USING "${name}"::${sqlType(column)}`
        );
        /**
         * Only this branch rewrites. The `clearOnTypeChange` branch above is a catalog operation and stays flat
         * whatever the row count — and it is the path production uses, so reporting a rewrite there would warn
         * about the one case that is always instant.
         */
        requiresRewrite = true;
      }
    }

    // 4) Drops LAST: a field with no rename hint really does count as deleted.
    for (const [name] of before) {
      if (after.has(name)) continue;
      changes.push({kind: "dropColumn", column: name});
      statements.push(`ALTER TABLE ${table} DROP COLUMN "${name}"`);
    }

    // Read only when something rewrites; otherwise `plan()` stays a pure function over the two definitions.
    const estimatedRows = requiresRewrite ? await this.estimateRows(to.collection) : undefined;
    const longRunning =
      requiresRewrite &&
      (estimatedRows === undefined || estimatedRows > this.options.rewriteThreshold);

    return {
      collection: to.collection,
      changes,
      statements,
      requiresRewrite,
      estimatedRows,
      longRunning
    };
  }

  /**
   * `reltuples`, not `count(*)`: deciding whether a migration is slow must not itself cost a table scan.
   *
   * A failure returns `undefined` rather than raising — the table may not exist yet, and refusing to plan over
   * a missing statistic would turn a UX signal into an outage.
   */
  private async estimateRows(collection: string): Promise<number | undefined> {
    try {
      const {rows} = await this.db.query<{estimate: number}>(
        `SELECT GREATEST(reltuples, 0)::bigint::int AS estimate
         FROM pg_class WHERE oid = $1::regclass`,
        [`${BUCKET_SCHEMA}.${collection}`]
      );
      return rows[0]?.estimate;
    } catch {
      return undefined;
    }
  }

  /**
   * Applies the plan **in a single transaction**, with `lock_timeout` and a bounded retry so an
   * `ACCESS EXCLUSIVE` queue does not build up behind a long read and block every write. A lock that cannot be
   * taken leaves the plan **not applied** and raises.
   */
  async apply(plan: SchemaPlan): Promise<void> {
    if (!plan.statements.length) return;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        await this.runner.transaction(async client => {
          await client.query(`SET LOCAL lock_timeout = '${this.options.lockTimeout}'`);
          for (const statement of plan.statements) await client.query(statement);
          await client.query(
            `INSERT INTO ${SYSTEM_SCHEMA}."bucket_schema_changes" ("bucket_id", "sql") VALUES ($1, $2)`,
            [plan.collection, plan.statements.join(";\n")]
          );
        });
        return;
      } catch (error: any) {
        // 55P03 = lock_not_available, 40P01 = deadlock_detected
        const retryable = error?.code === "55P03" || error?.code === "40P01";
        if (!retryable) throw error;
        if (attempt === this.options.maxAttempts) {
          throw new SchemaLockTimeoutError(plan.collection, attempt);
        }
        await sleep(attempt * 250);
      }
    }
  }

  /** reports the drift between the intent (the `buckets` definition) and the derivative (the physical schema). */
  async verify(spec: TableSpec): Promise<SchemaDrift> {
    const {rows} = await this.db.query<{column_name: string; data_type: string; udt_name: string}>(
      `SELECT column_name, data_type, udt_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2`,
      [BUCKET_SCHEMA, spec.collection]
    );

    const actual = new Map(rows.map(row => [row.column_name, normalizeType(row)]));
    actual.delete("_id");

    const missingColumns: string[] = [];
    const typeMismatches: SchemaDrift["typeMismatches"] = [];

    for (const column of spec.columns) {
      const found = actual.get(column.name);
      if (!found) {
        missingColumns.push(column.name);
        continue;
      }
      const expected = sqlType(column);
      if (found !== expected) {
        typeMismatches.push({column: column.name, expected: column.kind, actual: found});
      }
      actual.delete(column.name);
    }

    return {
      collection: spec.collection,
      missingColumns,
      unexpectedColumns: [...actual.keys()],
      typeMismatches
    };
  }
}

/** Makes `information_schema` types comparable with the output of `columnKindToSqlType`. */
function normalizeType(row: {data_type: string; udt_name: string}): string {
  if (row.data_type === "ARRAY") {
    return row.udt_name === "_text" ? "text[]" : "double precision[]";
  }
  switch (row.data_type) {
    case "character varying":
    case "text":
      return "text";
    case "character":
      return "char(24)";
    case "double precision":
      return "double precision";
    case "boolean":
      return "boolean";
    case "timestamp with time zone":
      return "timestamptz";
    case "jsonb":
      return "jsonb";
    case "bytea":
      return "bytea";
    default:
      return row.data_type;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * The jsonb counterpart of Mongo's `$[]` (positional-all) operator.
 *
 * `{$unset: {"a.$[].$[].b": ""}}` means "delete the `b` key from every element of every inner array". In
 * PostgreSQL `#-` only deletes a **fixed** path, there is no operator that walks all the elements of an
 * array — and opening this shape up in the compiler would mean producing SQL that varies with the depth
 * of the path.
 *
 * Who produces it: clearing the fields that were removed, or whose type changed, from the documents
 * when a bucket schema is updated (`crud.ts:updateDocumentsOnChange`). A field of objects inside an
 * array arrives with `$[]` and the earlier version took that for a fixed path and produced
 * `#- '{$[],$[],b}'`: valid SQL, but it **deletes nothing** — a silently wrong result.
 *
 * `IMMUTABLE`: the same output for the same input, with no side effects.
 */
const DEEP_UNSET_FUNCTION = `
CREATE OR REPLACE FUNCTION ${SYSTEM_SCHEMA}.jsonb_unset_deep(target jsonb, path text[])
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  head text;
  rest text[];
  item jsonb;
  acc jsonb;
BEGIN
  IF target IS NULL OR array_length(path, 1) IS NULL THEN
    RETURN target;
  END IF;

  head := path[1];
  rest := path[2:];

  IF head = '$[]' THEN
    IF jsonb_typeof(target) <> 'array' THEN
      RETURN target;
    END IF;
    acc := '[]'::jsonb;
    FOR item IN SELECT value FROM jsonb_array_elements(target) LOOP
      acc := acc || jsonb_build_array(${SYSTEM_SCHEMA}.jsonb_unset_deep(item, rest));
    END LOOP;
    RETURN acc;
  END IF;

  IF jsonb_typeof(target) <> 'object' OR NOT target ? head THEN
    RETURN target;
  END IF;

  IF array_length(rest, 1) IS NULL THEN
    RETURN target - head;
  END IF;

  RETURN jsonb_set(target, ARRAY[head], ${SYSTEM_SCHEMA}.jsonb_unset_deep(target->head, rest));
END;
$fn$`;
