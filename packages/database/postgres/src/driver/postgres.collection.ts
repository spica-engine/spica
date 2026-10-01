import {from, Observable} from "rxjs";
import {map, switchMap} from "rxjs/operators";
import {ObjectId} from "bson";
import {
  ChangeStreamOptions,
  ChangeOperation,
  CollectionOptions,
  CollectionStatus,
  CreateIndexOptions,
  DatabaseChange,
  DocumentFilter,
  DocumentUpdate,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  FindOptions,
  ICollection,
  Id,
  ISupportsChanges,
  OptionalUnlessRequiredId,
  ReadPlan,
  ReadResult,
  SortSpec,
  TableSpec,
  DuplicateKeyError,
  UnsupportedCapabilityError,
  UnsupportedExpressionError,
  WithId
} from "@spica-server/database-driver";
import {Bucket} from "@spica-server/interface-bucket";
import {compileCrudFilter, normalizeIdFilter} from "../compiler/crud-filter-to-sql.js";
import {compileCrudUpdate} from "../compiler/crud-update-to-sql.js";
import {compileCreateIndex, deriveIndexName} from "../compiler/index-to-sql.js";
import {compileReadPlan} from "../compiler/read-plan-to-sql.js";
import {compileAggregate} from "../compiler/aggregate-to-sql.js";
import {Codec, createCodec, hexIfObjectId, RowShape} from "../schema/codec.js";
import {BUCKET_SCHEMA} from "../schema/naming.js";
import {compileAttachTriggers} from "../cdc/changes-schema.js";
import {systemTable} from "../schema/system-tables.js";
import {runIdempotentDdl} from "./idempotent-ddl.js";
import {PostgresChangeStream} from "../cdc/postgres.change-stream.js";
import {registerTtlIndex, TtlSweeper} from "./ttl-sweeper.js";

/** The driver's query surface — either a `pg.Pool` or a transaction client. */
export interface PooledClient {
  query<R = any>(sql: string, params?: unknown[]): Promise<{rows: R[]; rowCount: number | null}>;
  release(): void;
}

export interface Queryable {
  query<R = any>(sql: string, params?: unknown[]): Promise<{rows: R[]; rowCount: number | null}>;
  /**
   * Not named `connect`: `pg`'s `PoolClient` has its own `connect()` with a different signature, so a
   * `PoolClient` could not satisfy this interface structurally under that name.
   */
  acquireClient?(): Promise<PooledClient>;
}

/**
 * The codec is applied **at the boundary**: the row ↔ document conversion happens on the way in and out
 * only, and the row representation never travels inward.
 */
export class PostgresCollection<T = any> implements ICollection<T>, ISupportsChanges<T> {
  readonly options: CollectionOptions;
  private codec: Codec;

  /** Table definitions of relation targets — `read()` needs the `to_jsonb` column list. */
  relationTargets: Record<string, TableSpec> = {};
  /** The requesting identity; `auth.*` in an ACL expression is resolved from it at compile time. */
  auth?: Record<string, any>;

  constructor(
    private db: Queryable,
    readonly name: string,
    private table: TableSpec,
    private schema: Bucket,
    options: CollectionOptions = {},
    private collectionFactory?: (name: string, options?: CollectionOptions) => ICollection<any>,
    private changeStream?: PostgresChangeStream,
    private ttlSweeper?: () => TtlSweeper,
    /** `read()`'s `LATERAL` join needs the target's column list; the plan carries only its name. */
    private resolveTable?: (collection: string) => TableSpec | undefined
  ) {
    this.options = options;
    this.codec = createCodec(schema, {
      overflow: table.overflowColumn,
      textId: table.idKind === "text"
    });

  }

  private _initialized?: Promise<void>;

  /** See `ICollection.initialized`. Undefined when there is nothing to wait for. */
  get initialized(): Promise<void> | undefined {
    return this._initialized;
  }

  /**
   * Deliberately not done in the constructor: both creation sites call this immediately, so the work
   * still starts as early as it did before, while construction stays synchronous. The failure is
   * carried on `initialized`, where `onModuleInit` reports it, rather than taking down construction.
   */
  beginInitialization(): this {
    if (this._initialized !== undefined || !this.options.afterInit) return this;
    this._initialized = Promise.resolve()
      .then(() => this.options.afterInit())
      .then(() => undefined);
    // See the counterpart in `MongoCollection`: this keeps an unawaited failure from being an
    // unhandled rejection without hiding it from a caller that does await.
    this._initialized.catch(() => {});
    return this;
  }

  private get qualified(): string {
    return `${this.table.namespace || BUCKET_SCHEMA}."${this.name}"`;
  }

  // ────────────────────────────────────────────────────────────── reads
  async find(filter?: DocumentFilter<T>, options: FindOptions = {}): Promise<WithId<T>[]> {
    const where = compileCrudFilter(normalizeIdFilter(filter), {table: this.table});
    const params = [...where.params];

    const parts = [
      `SELECT ${this.selectList(options.projection)} FROM ${this.qualified} WHERE ${where.sql}`
    ];
    const order = this.orderBy(options.sort);
    if (order) parts.push(order);
    if (options.limit !== undefined) parts.push(`LIMIT $${params.push(options.limit)}`);
    if (options.skip) parts.push(`OFFSET $${params.push(options.skip)}`);

    const {rows} = await this.db.query(parts.join(" "), params);
    return rows.map(row => this.codec.toDocument(row) as WithId<T>);
  }

  /**
   * `projection` → the `SELECT` list. Callers hide secrets with it (`refresh_token`'s `token`), so an
   * unapplied projection leaks them. As in Mongo, inclusion and exclusion cannot be mixed except `_id`.
   */
  private selectList(projection?: Record<string, 0 | 1 | boolean>): string {
    if (!projection || !Object.keys(projection).length) return "*";

    const entries = Object.entries(projection).filter(([field]) => field !== "_id");
    const includes = entries.filter(([, v]) => v === 1 || v === true).map(([f]) => f);
    const excludes = entries.filter(([, v]) => v === 0 || v === false).map(([f]) => f);

    if (includes.length && excludes.length) {
      throw new UnsupportedExpressionError(
        "mixed projection (both inclusion and exclusion)",
        "postgres"
      );
    }

    const all = this.table.columns.map(column => column.name);
    const kept = includes.length ? includes : all.filter(name => !excludes.includes(name));

    for (const field of kept) {
      if (!all.includes(field)) {
        throw new UnsupportedExpressionError(
          `projection on '${field}', which is not a property of this collection`,
          "postgres"
        );
      }
    }

    return ['"_id"', ...kept.map(name => `"${name}"`)].join(", ");
  }

  async findOne(filter: DocumentFilter<T>, options: FindOptions = {}): Promise<WithId<T>> {
    return this.readOne(filter, options);
  }

  /**
   * The internal counterpart of `findOne`: `findOneAndUpdate`/`findOneAndReplace` are composed of a read
   * plus a write here, and going through the public surface would let a subclass override or a test stub
   * step into the middle of one server command's equivalent.
   */
  private async readOne(filter: DocumentFilter<T>, options: FindOptions = {}): Promise<WithId<T>> {
    const [document] = await this.find(filter, {...options, limit: 1});
    return document ?? (null as any);
  }

  async estimatedDocumentCount(): Promise<number> {
    // `reltuples` is an estimate; the contract declares this "approximate". It can come back as -1 on
    // a table that was never ANALYZEd, so we fall back to an exact count.
    const {rows} = await this.db.query<{estimate: number}>(
      `SELECT GREATEST(reltuples, 0)::bigint::int AS estimate
       FROM pg_class WHERE oid = $1::regclass`,
      [this.qualified]
    );
    const estimate = rows[0]?.estimate ?? 0;
    return estimate > 0 ? estimate : this.countDocuments();
  }

  async countDocuments(filter?: DocumentFilter<T>): Promise<number> {
    const where = compileCrudFilter(filter as any, {table: this.table});
    const {rows} = await this.db.query<{total: number}>(
      `SELECT count(*)::int AS total FROM ${this.qualified} WHERE ${where.sql}`,
      where.params
    );
    return rows[0]?.total ?? 0;
  }

  async getStatus(): Promise<CollectionStatus> {
    return {
      limit: this.options.entryLimit,
      current: await this.estimatedDocumentCount(),
      unit: "count"
    };
  }

  /** A write query; it translates PostgreSQL errors into contract errors (`23505` → `DuplicateKeyError`). */
  private async write<R = any>(
    sql: string,
    params: unknown[]
  ): Promise<{rows: R[]; rowCount: number | null}> {
    try {
      return await this.db.query<R>(sql, params);
    } catch (error: any) {
      if (error?.code === "23505") {
        throw new DuplicateKeyError(
          error.constraint || "unknown",
          error.detail,
          parseDuplicateKey(error.detail)
        );
      }
      throw error;
    }
  }

  /**
   * `pg` turns a JS array into a Postgres array literal (`{a,b}`), which is right for `text[]` and
   * invalid for `jsonb` — so a json column is stringified here rather than in the codec, whose job is
   * the document ↔ row mapping and not wire serialisation.
   */
  private bindValue(column: string, value: unknown): unknown {
    if (value === null || value === undefined) return value;
    const kind = this.table.columns.find(c => c.name === column)?.kind;
    return kind === "json" || kind === "location" ? JSON.stringify(value) : value;
  }

  // ───────────────────────────────────────────────────────────── writes
  async insertOne(document: OptionalUnlessRequiredId<T>): Promise<WithId<T>> {
    await this.assertEntryLimit(1);

    const withId = this.ensureId(document);
    const {row} = this.codec.toRow(withId as any);
    const columns = Object.keys(row);
    const values = columns.map((_, index) => `$${index + 1}`);

    await this.write(
      `INSERT INTO ${this.qualified} (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${values.join(", ")})`,
      columns.map(column => this.bindValue(column, row[column]))
    );

    return withId as WithId<T>;
  }

  /**
   * A multi-row `INSERT` per run of documents sharing a column set, replayed one document at a time when
   * a chunk fails.
   *
   * The replay is what reproduces Mongo's `ordered: true`: a failed multi-row statement wrote nothing,
   * so without it the documents before the offending one would be lost. Grouping by column set keeps
   * input order, which that guarantee depends on.
   */
  async insertMany(documents: OptionalUnlessRequiredId<T>[]): Promise<Id[]> {
    await this.assertEntryLimit(documents.length);

    // `ensureId` mutates the input, the same as `insertOne` — call sites rely on `_id` appearing on it.
    const prepared = documents.map(document => {
      const withId = this.ensureId(document);
      const {row} = this.codec.toRow(withId as any);
      return {document, row, columns: Object.keys(row), id: (withId as any)._id as Id};
    });

    for (const run of consecutiveRuns(prepared, entry => entry.columns.join("\u0000"))) {
      for (const chunk of chunked(run, this.insertChunkSize(run[0].columns.length))) {
        try {
          await this.write(...this.compileBulkInsert(chunk));
        } catch {
          // The error the offending document raises is the one the caller should see, with its own
          // contract translation — deliberately not the chunk's error.
          for (const entry of chunk) {
            await this.write(...this.compileBulkInsert([entry]));
          }
          throw new Error(
            "unreachable: the replay must raise on the document the chunk failed for"
          );
        }
      }
    }

    return prepared.map(entry => entry.id);
  }

  /** `INSERT … VALUES (…), (…)` for documents that share a column set. */
  private compileBulkInsert(
    entries: {row: Record<string, unknown>; columns: string[]}[]
  ): [string, unknown[]] {
    const columns = entries[0].columns;
    const params: unknown[] = [];

    const tuples = entries.map(entry => {
      const placeholders = columns.map(column => {
        params.push(this.bindValue(column, entry.row[column]));
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    const list = columns.map(column => `"${column}"`).join(", ");
    return [`INSERT INTO ${this.qualified} (${list}) VALUES ${tuples.join(", ")}`, params];
  }

  /** PostgreSQL takes at most 65535 bind parameters per statement, so rows shrink as columns grow. */
  private insertChunkSize(columnCount: number): number {
    return Math.max(1, Math.min(1000, Math.floor(60_000 / Math.max(1, columnCount))));
  }

  /**
   * `single` narrows the update to one row via the primary key. `matched` is separate from `rowCount`
   * because an update that assigns nothing (`$setOnInsert` alone) issues no `UPDATE`: collapsing them
   * would make an upsert insert a second row on top of the matching one.
   */
  private async writeColumns(
    update: Record<string, any>,
    filter: DocumentFilter<T>,
    options: {upsert?: boolean},
    single: boolean
  ): Promise<{rowCount: number | null; matched: boolean}> {
    const set = compileCrudUpdate(update as any, {table: this.table, upsert: options.upsert});
    if (!set.sql) return {rowCount: 0, matched: (await this.countDocuments(filter)) > 0};

    const where = compileCrudFilter(filter as any, {
      table: this.table,
      paramOffset: set.params.length
    });

    // PostgreSQL has no `UPDATE … LIMIT 1`; the primary key is used to narrow it.
    const sql = single
      ? `UPDATE ${this.qualified} SET ${set.sql}
       WHERE "_id" = (SELECT "_id" FROM ${this.qualified} WHERE ${where.sql} LIMIT 1)`
      : `UPDATE ${this.qualified} SET ${set.sql} WHERE ${where.sql}`;

    const {rowCount} = await this.write(sql, [...set.params, ...where.params]);
    return {rowCount, matched: (rowCount ?? 0) > 0};
  }

  async updateMany(
    filter: DocumentFilter<T>,
    update: DocumentUpdate<T>,
    options: {upsert?: boolean} = {}
  ): Promise<number> {
    const {rowCount, matched} = await this.writeColumns(update as any, filter, options, false);

    // Same rationale as `updateOne`: no match plus `upsert` → insert (Mongo semantics).
    if (!matched && options.upsert) {
      await this.insertOne(upsertSeed(filter, update) as any);
      return 1;
    }

    return rowCount ?? 0;
  }

  async updateOne(
    filter: DocumentFilter<T>,
    update: DocumentUpdate<T>,
    options: {upsert?: boolean} = {}
  ): Promise<number> {
    const {rowCount, matched} = await this.writeColumns(update as any, filter, options, true);

    // No match plus `upsert` → insert (Mongo semantics).
    if (!matched && options.upsert) {
      await this.insertOne(upsertSeed(filter, update) as any);
      return 1;
    }

    return rowCount ?? 0;
  }

  /**
   * In SQL an update and a replace are both an `UPDATE`, so the statement cannot carry the distinction
   * Mongo's change events make; it is announced to the CDC trigger through a session variable instead.
   */
  async replaceOne(filter: DocumentFilter<T>, document: T, options: any = {}): Promise<number> {
    return this.asReplace(
      scoped => scoped.updateOne(filter, document as any, options),
      () => this.updateOne(filter, document as any, options)
    );
  }

  /**
   * Runs the work with `spica.change_op = 'replace'` in effect. `is_local := true` is what keeps the
   * setting from leaking to the connection returned to the pool. Without `acquireClient` the collection
   * is already scoped to a client, so the work relies on the outer scope's mark instead of nesting.
   */
  private async asReplace<R>(
    work: (scoped: PostgresCollection<T>) => Promise<R>,
    fallback: () => Promise<R>
  ): Promise<R> {
    if (!this.db.acquireClient) return fallback();

    const client = await this.db.acquireClient();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('spica.change_op', 'replace', true)");
      const scoped = new PostgresCollection<T>(
        client,
        this.name,
        this.table,
        this.schema,
        this.options,
        this.collectionFactory,
        this.changeStream,
        this.ttlSweeper,
        this.resolveTable
      ).beginInitialization();
      const result = await work(scoped);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteMany(filter: DocumentFilter<T>): Promise<number> {
    const where = compileCrudFilter(filter as any, {table: this.table});
    const {rowCount} = await this.db.query(
      `DELETE FROM ${this.qualified} WHERE ${where.sql}`,
      where.params
    );
    return rowCount ?? 0;
  }

  async deleteOne(filter: DocumentFilter<T>): Promise<number> {
    const where = compileCrudFilter(filter as any, {table: this.table});
    const {rowCount} = await this.db.query(
      `DELETE FROM ${this.qualified}
       WHERE "_id" = (SELECT "_id" FROM ${this.qualified} WHERE ${where.sql} LIMIT 1)`,
      where.params
    );
    return rowCount ?? 0;
  }

  // ──────────────────────────────────────────────────────── read-and-write
  async findOneAndUpdate(
    filter: DocumentFilter<T>,
    update: DocumentUpdate<T>,
    options: FindOneAndUpdateOptions = {}
  ): Promise<WithId<T>> {
    // `ReturnDocument` is a string enum; comparing the value directly covers both forms.
    const after = String(options.returnDocument) === "after";
    // `sort` picks which matching document is taken; dropping it would quietly update the wrong row.
    const before = await this.readOne(filter, {sort: options.sort});

    if (!before) {
      /**
       * Mongo builds the inserted document from the filter's equality conditions plus the update's
       * `$set`/`$setOnInsert`; `returnDocument: "before"` gives `null` because there is no before.
       */
      if (!options.upsert) return null as any;

      const inserted = await this.insertOne(upsertSeed(filter, update) as any);
      return after ? (inserted as any) : (null as any);
    }

    await this.updateOne({_id: (before as any)._id} as any, update, options as any);
    // `projection` had to be passed through: `refresh_token` hides its secret fields with it.
    return after
      ? this.readOne({_id: (before as any)._id} as any, {
          projection: (options as any).projection
        })
      : before;
  }

  /**
   * A replace too, so the change event has to be marked as one: the realtime layer reads `operationType`
   * and the client waits for `Replace`. Going straight to `findOneAndUpdate` would emit `update`.
   */
  async findOneAndReplace(
    filter: DocumentFilter<T>,
    document: T,
    options: FindOneAndReplaceOptions = {}
  ): Promise<WithId<T>> {
    return this.asReplace(
      scoped => scoped.findOneAndUpdate(filter, document as any, options),
      () => this.findOneAndUpdate(filter, document as any, options)
    );
  }

  async findOneAndDelete(
    filter: DocumentFilter<T>,
    options: FindOneAndDeleteOptions = {}
  ): Promise<WithId<T>> {
    const document = await this.readOne(filter, {sort: options.sort});
    if (!document) return null as any;
    await this.deleteOne({_id: (document as any)._id} as any);
    return document;
  }

  // ──────────────────────────────────────────────────────────── indexes
  /**
   * `expireAfterSeconds` becomes a sweeper registration rather than an error — the mechanism differs
   * from Mongo's TTL index, the feature does not, and `nativeTTLIndex: false` declares that.
   *
   * The registration is keyed **by name** because `BucketService.updateIndexes` compares wanted against
   * existing by name, which is what lets a TTL dropped from the definition be removed.
   */
  async createIndex(spec: any, options: CreateIndexOptions = {}): Promise<string> {
    const normalized = toSpec(spec);

    if (options.expireAfterSeconds !== undefined) {
      if (!this.ttlSweeper) {
        throw new UnsupportedCapabilityError("a TTL index without a sweeper", "postgres");
      }

      const indexName = normalized.name || deriveIndexName(normalized);
      registerTtlIndex(
        this.ttlSweeper(),
        this.name,
        indexName,
        normalized.keys,
        options.expireAfterSeconds
      );
      return indexName;
    }

    const statement = compileCreateIndex(this.table, normalized, options);
    await this.db.query(statement.sql, statement.params);
    // The name is returned, as Mongo's `createIndex` does; `deriveIndexName` mirrors its convention.
    return normalized.name || deriveIndexName(normalized);
  }

  /**
   * Deletes documents after a given time, based on `created_at` — the same fixed field Mongo's TTL index
   * uses. The deletion comes from `TtlSweeper`, so the timing guarantee is periodic rather than
   * immediate; `nativeTTLIndex: false` declares that.
   */
  upsertTTLIndex(expireAfterSeconds: number): Promise<unknown> {
    if (!this.ttlSweeper) {
      return Promise.reject(
        new UnsupportedCapabilityError("upsertTTLIndex() without a sweeper", "postgres")
      );
    }

    this.ttlSweeper().register({
      table: this.name,
      field: "created_at",
      seconds: expireAfterSeconds
    });
    return Promise.resolve(undefined);
  }

  private triggerAttach?: Promise<void>;

  /**
   * Attaches the CDC trigger on the first subscription, so a collection nobody watches pays nothing for
   * the outbox insert.
   *
   * No event is lost by attaching this late: a subscriber starts at the frontier, so rows written before
   * it existed were never going to reach it.
   *
   * **Detaching is deliberately not done.** The reference count would have to be shared across replicas,
   * and one replica deciding "no more watchers" would silently blind another's. A trigger goes only with
   * its table.
   */
  private ensureTriggersAttached(): Promise<void> {
    if (!this.triggerAttach) {
      this.triggerAttach = this.attachTriggers();
    }
    return this.triggerAttach;
  }

  /**
   * A system table's trigger is already on from `bootstrap()`, and the early return is **required**, not an
   * optimisation: several system-table consumers subscribe and write immediately without waiting for
   * `onReady`, so an `await` here would move the frontier past their own write and the event would never
   * be delivered.
   */
  private async attachTriggers(): Promise<void> {
    if (systemTable(this.name)) return;

    const schema = this.table.namespace || BUCKET_SCHEMA;
    for (const statement of compileAttachTriggers(this.name, schema)) {
      await runIdempotentDdl(this.db, statement.sql, statement.params);
    }
  }

  watch(pipeline?: object[], options: ChangeStreamOptions = {}): Observable<any> {
    if (!this.changeStream) {
      throw new UnsupportedCapabilityError("watch() without a change stream", "postgres");
    }

    const operations = operationsFromPipeline(pipeline);

    // Readiness is announced by the change stream once its watermark is fixed; the trigger being
    // attached is only half of it.
    return from(this.ensureTriggersAttached()).pipe(
      switchMap(() => this.changeStream!.changes(this.name, {...options, operations})),
      map(change => toMongoShapedChange(this.decodeChange(change), this.name))
    );
  }

  /**
   * The CDC trigger writes `to_jsonb(NEW)`, so the outbox carries the **row**. Without the codec the
   * payload leaks the driver's internal shape: the overflow column appears as a nested object instead of
   * top-level fields, `NULL` columns stay present, and translatable fields remain language maps.
   */
  private decodeChange(change: DatabaseChange<T>): DatabaseChange<T> {
    const decode = (row: unknown) =>
      row && typeof row === "object" ? (this.codec.toDocument(row as any) as T) : (row as T);

    return {
      ...change,
      // The id too: the outbox stores `doc_id` as text while the contract declares an `Id`.
      ...(change.documentId !== undefined
        ? {documentId: this.codec.decodeId(change.documentId)}
        : {}),
      ...(change.document !== undefined ? {document: decode(change.document)} : {}),
      ...(change.previousDocument !== undefined
        ? {previousDocument: decode(change.previousDocument)}
        : {})
    };
  }

  /**
   * A finite subset of the aggregation pipeline. An unsupported stage raises rather than being skipped.
   *
   * The query is lazy — no SQL runs before `toArray()`/`next()` — because some callers build a cursor
   * and never consume it.
   */
  aggregate<R = any>(pipeline: object[] = []): any {
    const plan = compileAggregate(pipeline, {
      table: this.table,
      qualified: this.qualified,
      // `$lookup` targets: the caller's relation targets first, then the system tables.
      resolveTarget: name => this.relationTargets[name] || systemTable(name)
    });

    const run = async (statement: {sql: string; params: unknown[]}): Promise<any[]> => {
      const result = await this.db.query(statement.sql, statement.params);
      // `$count` gives an aggregate row, not a document; the codec would look for `_id` and corrupt it.
      const isAggregation = /count\(\*\)/.test(statement.sql);
      return isAggregation ? result.rows : result.rows.map(row => this.codec.toDocument(row));
    };

    const rows = async (): Promise<R[]> => {
      if (plan.kind === "rows") return (await run(plan.statement)) as R[];

      // `$facet` gives one document: `{meta: [{total}], data: [...]}`. The pair runs in parallel because
      // a single statement with `count(*) OVER ()` measured 38% slower.
      const [data, meta] = await Promise.all([run(plan.data), run(plan.count)]);
      const total = meta.length ? meta[0][plan.metaField] : 0;
      // `flattenMeta`: the caller used to reduce the array to an object with `$set`; we produce the shape directly.
      const metaValue = plan.flattenMeta ? {[plan.metaField]: total} : [{[plan.metaField]: total}];
      return [{meta: metaValue, data}] as R[];
    };

    return {
      toArray: rows,
      next: async () => {
        const all = await rows();
        return all.length ? all[0] : null;
      },
      [Symbol.asyncIterator]: async function* (this: any) {
        for (const row of await rows()) yield row;
      }
    };
  }

  findOnProfiler(): any {
    // The counterpart is `pg_stat_statements`; its interface differs, so it is not offered through this method.
    throw new UnsupportedCapabilityError("system.profile (use pg_stat_statements)", "postgres");
  }

  /** `data` and `count` run in parallel, as Mongo's `executePaginationPlan` does. */
  async read(plan: ReadPlan): Promise<ReadResult<T>> {
    // Target definitions are resolved from the driver; explicitly given ones still take precedence.
    const targets: Record<string, TableSpec> = {...this.relationTargets};
    // `children` are resolved too: a nested relation's target sits deeper in the tree.
    const collectTargets = (relations: ReadPlan["relations"] = []) => {
      for (const relation of relations) {
        if (!targets[relation.target]) {
          const resolved = this.resolveTable?.(relation.target);
          if (resolved) targets[relation.target] = resolved;
        }
        collectTargets(relation.children);
      }
    };
    collectTargets(plan.relations);

    const statement = compileReadPlan(plan, {
      table: this.table,
      targets,
      auth: this.auth
    });

    const [data, total] = await Promise.all([
      this.db.query(statement.data.sql, statement.data.params),
      statement.count
        ? this.db.query<{total: number}>(statement.count.sql, statement.count.params)
        : Promise.resolve(undefined)
    ]);

    const shape: RowShape = {
      localized: new Set(plan.localize?.properties || []),
      resolved: new Set((plan.relations || []).map(relation => relation.path))
    };

    return {
      data: data.rows.map(row => this.codec.toDocument(row, shape) as T),
      total: total ? (total.rows[0]?.total ?? 0) : undefined
    };
  }

  /**
   * The neutral event stream. The `LISTEN` connection and the notification signal are shared through
   * `PostgresChangeStream`; the read round and its watermark are per subscriber.
   */
  changes(options: ChangeStreamOptions = {}): Observable<DatabaseChange<T>> {
    if (!this.changeStream) {
      throw new UnsupportedCapabilityError("changes() without a change stream", "postgres");
    }
    // The neutral surface hands over documents too, not rows — rationale in `decodeChange`.
    return from(this.ensureTriggersAttached()).pipe(
      switchMap(() => this.changeStream!.changes<T>(this.name, options)),
      map(change => this.decodeChange(change))
    );
  }

  collection<U = any>(name: string, options?: CollectionOptions): ICollection<U> {
    if (!this.collectionFactory) {
      throw new UnsupportedCapabilityError("collection() without a database factory", "postgres");
    }
    return this.collectionFactory(name, options) as ICollection<U>;
  }

  // ───────────────────────────────────────────────────────────── helpers
  private orderBy(sort?: SortSpec): string {
    if (!sort || !Object.keys(sort).length) return "";
    const known = new Set([...this.table.columns.map(c => c.name), "_id"]);
    const pieces = Object.entries(sort).map(([field, direction]) => {
      if (!known.has(field)) {
        throw new UnsupportedCapabilityError(`sorting by unknown property '${field}'`, "postgres");
      }
      return `"${field}" ${direction === -1 ? "DESC" : "ASC"}`;
    });
    return `ORDER BY ${pieces.join(", ")}`;
  }

  /**
   * Assigns `_id` and **mutates the input**, as the MongoDB driver does: call sites return the document
   * they passed in and expect `_id` to have appeared on it. A copy would leave `body._id` undefined.
   */
  private ensureId(document: any): any {
    if (document._id === undefined || document._id === null) {
      document._id = new ObjectId();
    }
    return document;
  }

  private async assertEntryLimit(incoming: number): Promise<void> {
    if (!this.options.entryLimit) return;
    const current = await this.countDocuments();
    if (current + incoming > this.options.entryLimit) {
      throw new Error("Maximum number of documents has been reached");
    }
  }
}

/** Converts a Mongo index spec object into an order-preserving `IndexSpec`. */
function toSpec(spec: any) {
  if (spec && Array.isArray(spec.keys)) return spec;
  return {
    keys: Object.entries(spec || {}).map(([field, direction]) => ({
      field,
      direction: (direction === -1 ? -1 : 1) as 1 | -1
    }))
  };
}

/**
 * `[{$match: {operationType: "insert"}}]` or `{$in: [...]}` → the contract's `operations` filter.
 *
 * An unrecognised stage raises rather than being skipped: a stream whose filter was never applied
 * delivers events the consumer does not expect, and that only shows up in production.
 */
function operationsFromPipeline(pipeline?: object[]): ChangeOperation[] | undefined {
  if (!pipeline || !pipeline.length) return undefined;

  const operations: ChangeOperation[] = [];

  for (const stage of pipeline) {
    const match = (stage as any).$match;
    if (!match || Object.keys(stage).length !== 1) {
      throw new UnsupportedExpressionError(
        `change stream pipeline stage ${JSON.stringify(stage)}`,
        "only {$match: {operationType: …}} is supported"
      );
    }

    const operationType = match.operationType;
    if (operationType === undefined || Object.keys(match).length !== 1) {
      throw new UnsupportedExpressionError(
        `change stream $match ${JSON.stringify(match)}`,
        "only operationType is supported"
      );
    }

    if (typeof operationType === "string") {
      operations.push(operationType as ChangeOperation);
    } else if (Array.isArray(operationType.$in)) {
      operations.push(...(operationType.$in as ChangeOperation[]));
    } else {
      throw new UnsupportedExpressionError(
        `change stream operationType ${JSON.stringify(operationType)}`,
        "expected a string or {$in: [...]}"
      );
    }
  }

  return operations;
}

/**
 * Neutral `DatabaseChange` → a Mongo change stream document. `ns.db` is deliberately absent: no consumer
 * reads it and inventing a value would be false information.
 */
function toMongoShapedChange(change: DatabaseChange, collection: string): Record<string, unknown> {
  const document: Record<string, unknown> = {
    operationType: change.operation,
    ns: {coll: change.collection || collection},
    documentKey: {_id: change.documentId}
  };

  if (change.document !== undefined) document.fullDocument = change.document;
  if (change.previousDocument !== undefined) {
    document.fullDocumentBeforeChange = change.previousDocument;
  }

  if (change.operation === "update" || change.operation === "replace") {
    document.updateDescription = {
      updatedFields: change.updatedFields || {},
      removedFields: change.removedFields || []
    };
  }

  return document;
}

/** Consecutive items whose key is equal, in input order. */
function consecutiveRuns<T>(items: T[], key: (item: T) => string): T[][] {
  const runs: T[][] = [];
  let currentKey: string | undefined;

  for (const item of items) {
    const itemKey = key(item);
    if (itemKey !== currentKey) {
      runs.push([]);
      currentKey = itemKey;
    }
    runs[runs.length - 1].push(item);
  }

  return runs;
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Extracts the conflicting field from PostgreSQL's `23505` detail (`Key (name)=(test) already exists.`),
 * which is what the Mongo driver reports as `keyValue`. Unparseable input gives `undefined` and
 * `DuplicateKeyError` falls back to the constraint name.
 */
function parseDuplicateKey(detail?: string): Record<string, unknown> | undefined {
  const match = /^Key \(([^)]+)\)=\((.*)\) already exists/.exec(detail || "");
  if (!match) return undefined;

  const fields = match[1].split(", ").map(field => field.trim().replace(/^"|"$/g, ""));
  const values = match[2].split(", ");
  return Object.fromEntries(fields.map((field, index) => [field, values[index]]));
}

/**
 * The document to insert on upsert: the filter's equalities plus the update's insert part. Dotted keys
 * are expanded into nested objects — a flat `"options.x"` field would insert the row and then read back
 * as missing.
 */
function upsertSeed(filter: any, update: any): Record<string, unknown> {
  const seed: Record<string, unknown> = {...equalityFields(filter)};
  for (const [key, value] of Object.entries(updateSeed(update))) {
    assignPath(seed, key.split("."), value);
  }
  return seed;
}

function assignPath(target: Record<string, unknown>, path: string[], value: unknown): void {
  const [head, ...rest] = path;
  if (!rest.length) {
    target[head] = value;
    return;
  }
  const existing = target[head];
  const child =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  target[head] = child;
  assignPath(child, rest, value);
}

/**
 * The filter's equality conditions, as Mongo does: no document can be built from `{views: {$gt: 5}}`, so
 * fields carrying operators and logical combinators are skipped.
 */
function equalityFields(filter: any): Record<string, unknown> {
  const seed: Record<string, unknown> = {};
  if (!filter || typeof filter !== "object") return seed;

  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith("$")) continue;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const hasOperator = Object.keys(value).some(k => k.startsWith("$"));
      if (hasOperator) continue;
    }
    seed[key] = value;
  }
  return seed;
}

/** The part of an update that applies on insert: the replacement document, or `$set`/`$setOnInsert`. */
function updateSeed(update: any): Record<string, unknown> {
  if (!update || typeof update !== "object") return {};

  const operators = Object.keys(update).filter(k => k.startsWith("$"));
  if (!operators.length) {
    // The replacement document as is, except `_id` (that is generated in `insertOne`).
    const {_id, ...rest} = update;
    return rest;
  }

  /**
   * `$inc`/`$push`/`$addToSet` go into the seed too, because Mongo applies them when inserting on upsert:
   * `$inc: {n: 1}` means `n: 1` in the new document. Skipping them leaves the field `NULL` and a counter
   * one behind.
   */
  const seed: Record<string, unknown> = {
    ...(update.$setOnInsert || {}),
    ...(update.$set || {})
  };

  for (const [field, amount] of Object.entries(update.$inc || {})) {
    if (!(field in seed)) seed[field] = amount;
  }

  for (const operator of ["$push", "$addToSet"] as const) {
    for (const [field, value] of Object.entries(update[operator] || {})) {
      if (field in seed) continue;
      const each = (value as any)?.$each;
      seed[field] = Array.isArray(each) ? each : [value];
    }
  }

  return seed;
}
