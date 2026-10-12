import {Pool, PoolClient} from "pg";
import {
  CollectionOptions,
  DriverCapabilities,
  ICollection,
  IDatabase,
  IIndexManager,
  TableSpec,
  UnsupportedCapabilityError
} from "@spica-server/database-driver";
import {Bucket} from "@spica-server/interface-bucket";
import {compileCreateSchemas, compileCreateTable} from "../compiler/table-to-sql.js";
import {runIdempotentDdl} from "./idempotent-ddl.js";
import {compileCreateIndex, compileDropIndex, deriveIndexName} from "../compiler/index-to-sql.js";
import {BUCKET_SCHEMA, SYSTEM_SCHEMA} from "../schema/naming.js";
import {
  DATABASE_CREATE_CHECK,
  MissingPrivilegeError,
  missingSchemaPrivileges,
  schemaPrivilegeCheck
} from "./privileges.js";
import {PooledClient, PostgresCollection, Queryable} from "./postgres.collection.js";
import {bucketToTable} from "../schema/bucket-to-table.js";
import {registerTtlIndex, TtlSweeper} from "./ttl-sweeper.js";
import {systemSchema, systemTable, systemTables} from "../schema/system-tables.js";
import {
  CHANGES_TABLE,
  compileAttachTriggers,
  compileCreateChangesTable,
  compileCreateTriggerFunctions
} from "../cdc/changes-schema.js";
import {PostgresChangeStream, PostgresChangeStreamOptions} from "../cdc/postgres.change-stream.js";

interface Prepared {
  table: TableSpec;
  schema: Bucket;
}

/** A collection whose schema cannot be resolved; the message tells the two causes apart. */
export class UnresolvedSchemaError extends Error {
  constructor(readonly collection: string) {
    super(
      `PostgreSQL driver cannot resolve a schema for '${collection}'. ` +
        `Bucket collections resolve through resolveSchema(); non-bucket collections are not ` +
        `mapped yet (AK-8). With an async resolver, call prime('${collection}') first.`
    );
  }
}

/** `server_version_num` form: 130000 is 13.0. The floor is 13 because of `xid8`. */
const MINIMUM_SERVER_VERSION = 130_000;

/** The PostgreSQL driver's capability declaration — K-10, the counterpart of `mongoCapabilities`. */
export const postgresCapabilities: DriverCapabilities = {
  backend: "postgres",
  version: "16",

  /**
   * A closed set of operators (`$gt`, `$in`, `$or`, `$regex`, …) compiles and anything outside it raises.
   * Neither `false` nor `true` is honest here: the panel reads this flag and hides interface on it.
   */
  rawMongoFilter: "subset",
  /** `$match`/`$sort`/`$skip`/`$limit`/`$project`/`$count` compile; `$lookup`/`$unwind`/`$group`/`$facet` raise. */
  aggregationPipeline: "subset",
  queryProfiler: "pg_stat_statements",
  nativeTTLIndex: false,
  indexOptions: {sparse: true, collation: false, partial: true},
  /**
   * The connection is conditional: the function role has to be provisioned, and without it the devkit
   * raises explicitly rather than handing over the API's own connection.
   */
  directAccessDevkit: "@spica-devkit/postgres",
  referentialIntegrity: true,
  // K-7: 1600 column slots per table, dropped ones included.
  maxLifetimeFieldsPerCollection: 1600,
  requiresReplicaSet: false
};

export interface PostgresDatabaseOptions {
  /**
   * The source that resolves bucket schemas; the table definition is derived from it when a collection is
   * opened. **Returning synchronously is preferred**, because `collection()` is synchronous; an
   * asynchronous source needs `prime()` called beforehand.
   */
  resolveSchema(collection: string): Promise<Bucket | undefined> | Bucket | undefined;
  /** The CDC consumer's settings (the `LISTEN` connection, the polling interval). */
  changeStream?: PostgresChangeStreamOptions;
}

/**
 * Opening a collection **requires a schema**: without the column types neither a filter can be compiled
 * nor a row converted. That is the one way this driver's surface differs from the schemaless original.
 */
export class PostgresDatabase implements IDatabase {
  readonly capabilities = postgresCapabilities;

  constructor(
    private pool: Pool,
    readonly name: string,
    private options: PostgresDatabaseOptions
  ) {}

  /** The pool's contract-conforming face; it narrows `acquireClient` to `PooledClient`. */
  private queryable: Queryable = {
    query: (sql, params) => this.pool.query(sql, params),
    acquireClient: async (): Promise<PooledClient> => {
      const client = await this.pool.connect();
      return {
        query: (sql, params) => client.query(sql, params),
        release: () => client.release()
      };
    }
  };

  /**
   * Creates the schemas and the shared CDC infrastructure; called once at startup. The per-table trigger
   * is attached elsewhere — eagerly for system tables, on first subscription for bucket tables.
   */
  async bootstrap(): Promise<void> {
    await this.verifyServerVersion();
    await this.verifyPrivileges();

    const statements = [
      ...compileCreateSchemas(),
      ...compileCreateChangesTable(),
      ...compileCreateTriggerFunctions(),
      // System tables (AK-8) — separate from bucket data, in the `spica` schema.
      ...systemTables().flatMap(table => compileCreateTable(table))
    ];
    for (const statement of statements) {
      await runIdempotentDdl(this.pool, statement.sql, statement.params);
    }

    /**
     * System tables are attached **eagerly**, unlike bucket tables: their CDC is infrastructure and some
     * of it is written before any subscriber has had a chance to register, so a lazy attach would open a
     * real window of silent event loss.
     */
    for (const table of systemTables()) {
      await this.ensureTriggers(table.collection, table.namespace || SYSTEM_SCHEMA);
    }

    await this.verifySchemaPrivileges();

    /**
     * The `LISTEN` registration belongs here, not to the caller: a consumer that hands over a
     * `listenClient` and never calls `start()` silently falls back to the 500 ms poll. Idempotent.
     */
    await this.changeStream().start();
  }

  /**
   * The watermark column is `xid8` and the read round calls `pg_current_xact_id()`/`pg_snapshot_xmin()`,
   * all of which arrived in PostgreSQL 13. Without this check an older server fails with
   * `type "xid8" does not exist`, which names a type nobody asked for instead of the requirement.
   */
  private async verifyServerVersion(): Promise<void> {
    const {rows} = await this.pool.query<{version: string}>(
      `SELECT current_setting('server_version_num') AS version`
    );
    const numeric = Number(rows[0]?.version);
    if (!Number.isFinite(numeric)) return;

    if (numeric < MINIMUM_SERVER_VERSION) {
      const readable = Math.floor(numeric / 10_000);
      throw new UnsupportedCapabilityError(
        `PostgreSQL ${readable} (13 or newer is required: the change-capture watermark uses xid8)`,
        "postgres"
      );
    }
  }

  /**
   * Two stages, because `has_schema_privilege` raises on a schema that does not exist: `CREATE` at the
   * database level first, then `USAGE`/`CREATE` per schema once the schemas are in place.
   */
  private async verifyPrivileges(): Promise<void> {
    const {rows} = await this.pool.query<{allowed: boolean}>(DATABASE_CREATE_CHECK);
    if (!rows[0]?.allowed) {
      throw new MissingPrivilegeError(["CREATE on the database"]);
    }
  }

  /** The check that runs once the schemas exist; called at the end of `bootstrap`. */
  private async verifySchemaPrivileges(): Promise<void> {
    const {rows} = await this.pool.query<Record<string, boolean>>(schemaPrivilegeCheck());
    const missing = missingSchemaPrivileges(rows[0] || {});
    if (missing.length) {
      throw new MissingPrivilegeError(missing);
    }
  }

  private _changeStream?: PostgresChangeStream;

  /**
   * The shared CDC consumer. Constructing it opens neither a connection nor a timer — both wait for the
   * first subscription — so every collection can take it and an installation without CDC pays nothing.
   */
  changeStream(): PostgresChangeStream {
    if (!this._changeStream) {
      this._changeStream = new PostgresChangeStream(this.pool, this.options.changeStream || {});
    }
    return this._changeStream;
  }

  private _ttlSweeper?: TtlSweeper;

  /**
   * The TTL sweeper runs on the `spica` schema because every call site that uses TTL is a system
   * collection. It starts on the first `upsertTTLIndex`, so an installation without TTL opens no timer.
   */
  ttlSweeper(): TtlSweeper {
    if (!this._ttlSweeper) {
      this._ttlSweeper = new TtlSweeper(this.pool, {schema: SYSTEM_SCHEMA});
      this._ttlSweeper.start();
    }
    return this._ttlSweeper;
  }

  /**
   * Attaches the CDC triggers to a collection's table. Idempotent. The schema is resolved rather than
   * fixed: system tables live in `spica`, and attaching to the wrong schema produces no events at all.
   */
  async ensureTriggers(collection: string, namespace?: string): Promise<void> {
    const schema =
      namespace ||
      this.prepared.get(collection)?.table.namespace ||
      systemTable(collection)?.namespace ||
      BUCKET_SCHEMA;

    for (const statement of compileAttachTriggers(collection, schema)) {
      await this.pool.query(statement.sql, statement.params);
    }
  }

  /**
   * Synchronous, so the schema is needed at that moment: an existing registration, then the synchronous
   * resolver. An asynchronous resolver needs `prime()` beforehand.
   */
  collection<T = any>(name: string, options?: CollectionOptions): ICollection<T> {
    const prepared = this.prepared.get(name) || this.resolveSync(name);
    if (!prepared) {
      throw new UnresolvedSchemaError(name);
    }
    return this.build<T>(name, prepared.table, prepared.schema, options);
  }

  private prepared = new Map<string, {table: TableSpec; schema: Bucket}>();

  /** Bucket schema first — that is what the tenant defines — then the fixed system tables. */
  private resolveSync(name: string): Prepared | undefined {
    const schema = this.options.resolveSchema(name);
    if (schema && typeof (schema as Promise<unknown>).then !== "function") {
      return this.register(name, schema as Bucket);
    }

    const system = systemSchema(name);
    if (system) {
      const prepared = {table: systemTable(name)!, schema: system};
      this.prepared.set(name, prepared);
      return prepared;
    }

    return undefined;
  }

  /** For asynchronous resolvers: resolves the schema up front and registers it. */
  async prime(name: string): Promise<boolean> {
    if (this.prepared.has(name)) return true;
    const schema = await this.options.resolveSchema(name);
    if (!schema) return false;
    this.register(name, schema);
    return true;
  }

  private register(name: string, schema: Bucket): Prepared {
    const prepared = {table: bucketToTable(schema), schema};
    this.prepared.set(name, prepared);
    return prepared;
  }

  /** For refreshing the derived table definition when the schema changes (K-12). */
  invalidate(name: string): void {
    this.prepared.delete(name);
  }

  /** Discards the cache and derives the definition again, without constructing a collection object. */
  refreshTable(name: string): TableSpec | undefined {
    this.invalidate(name);
    return this.resolveSync(name)?.table;
  }

  /**
   * Strips relations whose target table does not exist out of the DDL.
   *
   * **A dangling relation is a valid state**: a bucket's `bucketId` can point at one that was deleted,
   * which Mongo tolerates and an FK cannot (`42P01`), so without this the bucket could not be created at
   * all. The stripping is for the DDL **only** — the full definition is registered, so the read path
   * still sees the relation and raises if it is actually resolved.
   */
  async resolvable(table: TableSpec): Promise<TableSpec> {
    const targets = new Set<string>();
    for (const column of table.columns) {
      if (column.kind === "reference" && column.target) targets.add(column.target);
    }
    if (!targets.size) return table;

    const {rows} = await this.pool.query<{table_name: string}>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = ANY($2)`,
      [BUCKET_SCHEMA, [...targets]]
    );
    const existing = new Set(rows.map(row => row.table_name));
    // A self reference is valid: the table is being created in this very call and is not in the catalog yet.
    existing.add(table.collection);

    return {
      ...table,
      columns: table.columns.map(column =>
        column.kind === "reference" && column.target && !existing.has(column.target)
          ? {...column, target: undefined}
          : column
      )
    };
  }

  /** Resolves the schema, prepares the table and returns the collection. */
  async openCollection<T = any>(
    name: string,
    table: TableSpec,
    schema: Bucket,
    options?: CollectionOptions
  ): Promise<ICollection<T>> {
    this.prepared.set(name, {table, schema});
    return this.build<T>(name, table, schema, options);
  }

  private build<T>(
    name: string,
    table: TableSpec,
    schema: Bucket,
    options?: CollectionOptions
  ): ICollection<T> {
    return new PostgresCollection<T>(
      this.queryable,
      name,
      table,
      schema,
      options,
      (childName, childOptions) => this.collection(childName, childOptions),
      this.changeStream(),
      () => this.ttlSweeper(),
      target => this.tableOf(target)
    );
  }

  /**
   * The table definition of a relation target, for the `LATERAL` join in `read()`: the plan carries the
   * target's name, the driver finds its definition.
   */
  private tableOf(collection: string): TableSpec | undefined {
    const prepared = this.prepared.get(collection) || this.resolveSync(collection);
    return prepared?.table;
  }

  /**
   * Creates a collection; without a table definition it is derived from the schema resolver, because the
   * real caller passes only a name. There is no race: `BucketService` fills the schema cache first.
   */
  async createCollection(name: string, options?: Record<string, any>): Promise<ICollection> {
    let table = options?.table as TableSpec | undefined;
    let schema = options?.schema as Bucket | undefined;

    if (!table || !schema) {
      // The same resolution order as `collection()`: bucket schema → system table.
      const resolved = await this.options.resolveSchema(name);
      if (resolved) {
        schema = resolved;
        table = bucketToTable(resolved);
      } else {
        schema = systemSchema(name);
        table = systemTable(name);
      }

      if (!table || !schema) {
        throw new UnresolvedSchemaError(name);
      }
    }

    // The DDL is built with dangling relations stripped; the **full** definition is registered (the rationale is in `resolvable`).
    for (const statement of compileCreateTable(await this.resolvable(table))) {
      await this.pool.query(statement.sql, statement.params);
    }
    /**
     * A bucket table gets its trigger on first subscription instead, so one nobody watches pays nothing.
     * System tables keep the eager attach — the rationale is in `bootstrap`.
     */
    if (systemTable(name)) {
      await this.ensureTriggers(name);
    }

    return this.openCollection(name, table, schema);
  }

  /**
   * Bucket **and** system tables. The `rel` schema is left out: junction tables are an implementation
   * detail of relations, not collections the user has.
   */
  async listCollections(): Promise<{name: string}[]> {
    const {rows} = await this.pool.query<{name: string}>(
      `SELECT table_name AS name
         FROM information_schema.tables
        WHERE table_schema = ANY($1::text[])
          AND table_name <> ALL($2::text[])
        ORDER BY table_name`,
      [[BUCKET_SCHEMA, SYSTEM_SCHEMA], DRIVER_INTERNAL_TABLES]
    );
    return rows;
  }

  /**
   * Namespace aware, and it **recreates** a dropped system table: in MongoDB a dropped namespace comes
   * back by itself on the first write, and `bootstrap()` runs at startup only, so without this every
   * later access to it fails. A bucket table is not recreated — there the drop has to be permanent.
   */
  async dropCollection(name: string): Promise<boolean> {
    const system = systemTable(name);
    const namespace =
      this.prepared.get(name)?.table.namespace || system?.namespace || BUCKET_SCHEMA;

    await this.pool.query(`DROP TABLE IF EXISTS ${namespace}."${name}" CASCADE`);

    if (system) {
      for (const statement of compileCreateTable(system)) {
        await this.pool.query(statement.sql, statement.params);
      }
      return true;
    }

    this.prepared.delete(name);
    return true;
  }

  indexes(collection: string): IIndexManager {
    const prepared = this.prepared.get(collection) || this.resolveSync(collection);
    if (!prepared) {
      throw new UnresolvedSchemaError(collection);
    }
    return new PostgresIndexManager(this.pool, collection, prepared.table, () => this.ttlSweeper());
  }

  /**
   * The driver's single shutdown point. The two background jobs are `unref()`ed, so they do not keep the
   * process alive — but after the server is gone they still issue queries and produce `57P01`.
   */
  async close(): Promise<void> {
    // The order matters: the background jobs have to stop BEFORE the pool, otherwise they query a closed pool.
    await this.stopBackgroundWork();
    await this.pool.end();
  }

  /**
   * Stops the timers and the `LISTEN` handlers **without** ending the pool — a caller that deliberately
   * outlives its module (the test harness does) still has to shed its handlers, or one notification fans
   * out to drains against pools that are already closed.
   */
  async stopBackgroundWork(): Promise<void> {
    this._ttlSweeper?.stop();
    this._ttlSweeper = undefined;
    await this._changeStream?.stop();
    this._changeStream = undefined;
  }

  /** Raw SQL — not called from inside `packages/api`, bounded by the capability declaration (K-11). */
  async command(command: Record<string, any>): Promise<any> {
    const {rows} = await this.pool.query(command.sql, command.params);
    return rows;
  }

  /** Runs them in a single transaction; the basis of the DDL planner (K-7). */
  async transaction<R>(work: (client: PoolClient) => Promise<R>): Promise<R> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * The driver's own bookkeeping tables. They share the `spica` schema with system collections but are not
 * collections the user has, and when they leak the webhook trigger offers the CDC outbox as a target.
 */
const DRIVER_INTERNAL_TABLES = [CHANGES_TABLE, "bucket_schema_changes"];

/** The PostgreSQL implementation of `IIndexManager`. */
export class PostgresIndexManager implements IIndexManager {
  constructor(
    private pool: Pool,
    private collection: string,
    private table: TableSpec,
    private ttlSweeper?: () => TtlSweeper
  ) {}

  /**
   * The primary key's index is reported as `_id_`, Mongo's name for it, because `BucketService` filters
   * that name out of the index diff; under `<table>_pkey` it tries to drop the constraint's index.
   */
  async list() {
    const namespace = this.table.namespace || BUCKET_SCHEMA;
    const {rows} = await this.pool.query<{name: string; def: string}>(
      `SELECT indexname AS name, indexdef AS def FROM pg_indexes
       WHERE schemaname = $1 AND tablename = $2`,
      [namespace, this.collection]
    );
    const indexes = rows.map(row => ({
      name: row.name === `${this.collection}_pkey` ? "_id_" : row.name,
      keys: parseIndexKeys(row.def),
      unique: /CREATE UNIQUE INDEX/.test(row.def)
    }));

    /**
     * **Named** registrations are reported like indexes: they come from a bucket definition, and
     * `updateIndexes` compares by name, so an unreported one survives being removed from the definition
     * and keeps deleting rows. The unnamed ones from `upsertTTLIndex` belong to no definition and must
     * stay hidden, or `updateIndexes` tries to drop them.
     */
    for (const registration of this.ttlSweeper?.().namedRegistrations(this.collection) || []) {
      indexes.push({
        name: registration.indexName!,
        keys: [{field: registration.field, direction: 1}],
        unique: false,
        expireAfterSeconds: registration.seconds
      } as any);
    }

    return indexes;
  }

  /** `expireAfterSeconds` becomes a sweeper registration; `BucketService.updateIndexes` uses this path. */
  async create(spec: any, options: any = {}): Promise<string> {
    const name = spec.name || deriveIndexName(spec);

    if (options.expireAfterSeconds !== undefined) {
      if (!this.ttlSweeper) {
        throw new UnsupportedCapabilityError("a TTL index without a sweeper", "postgres");
      }
      registerTtlIndex(
        this.ttlSweeper(),
        this.collection,
        name,
        spec.keys,
        options.expireAfterSeconds
      );
      return name;
    }

    const statement = compileCreateIndex(this.table, spec, options);
    await this.pool.query(statement.sql, statement.params);
    return spec.name;
  }

  async drop(name: string): Promise<void> {
    // A TTL registration is not a real index; `DROP INDEX` will not find it.
    if (this.ttlSweeper?.().unregisterByName(this.collection, name)) return;

    const statement = compileDropIndex(name, this.table.namespace);
    await this.pool.query(statement.sql, statement.params);
  }

  /** On PostgreSQL retention is a sweeper registration, which `list()` deliberately does not show. */
  async ttlSeconds(): Promise<number | undefined> {
    return this.ttlSweeper?.().retentionSeconds(this.collection);
  }
}

/** Extracts the field order and direction from the `indexdef` text; the order is meaningful. */
function parseIndexKeys(definition: string): {field: string; direction: 1 | -1}[] {
  const match = definition.match(/\(([^)]*)\)\s*$/);
  if (!match) return [];
  return match[1].split(",").map(part => {
    const trimmed = part.trim();
    const field = trimmed.replace(/^"?([^"\s]+)"?.*$/, "$1");
    return {field, direction: /\bDESC\b/i.test(trimmed) ? (-1 as const) : (1 as const)};
  });
}
