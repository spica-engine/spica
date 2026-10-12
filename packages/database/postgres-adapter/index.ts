import {OnModuleDestroy} from "@nestjs/common";
import {Client, Pool} from "pg";
import {
  CollectionOptions,
  DriverCapabilities,
  ICollection,
  IIndexManager,
  ISchemaManager,
  ISupportsIndexManager,
  ISupportsSchemaManager,
  LogicalSchema,
  UnsupportedCapabilityError
} from "@spica-server/database-driver";
import {Bucket} from "@spica-server/interface-bucket";
import {
  bucketToTable,
  changesRetention,
  compileFunctionGrants,
  runIdempotentDdl,
  roleFromUri,
  PostgresChangeStream,
  PostgresDatabase,
  PostgresSchemaManager,
  SYSTEM_SCHEMA,
  TtlSweeper
} from "@spica-server/database-postgres";
import {DatabaseService} from "../src/database.service.js";

export type SchemaResolver = (collection: string) => Bucket | undefined;

/**
 * The PostgreSQL implementation of `DatabaseService`.
 *
 * This file is loaded **lazily** (`await import()` in `database.module.ts`), so `pg` never enters memory in
 * a MongoDB installation.
 *
 * **The schema resolver is a registration slot, not a constructor parameter**, because opening a collection
 * needs the bucket schemas and those live in `BucketService`, which depends on this service: a constructor
 * parameter would be a circular dependency. Without the registration no bucket collection can be opened and
 * `UnresolvedSchemaError` says so.
 */
export class PostgresDatabaseService
  extends DatabaseService
  implements ISupportsIndexManager, ISupportsSchemaManager, OnModuleDestroy
{
  /** Closes the connections and the background jobs on NestJS shutdown. */
  /**
   * With `closeOnDestroy: false` the pool **outlives the module**, which the test harness needs: the shared
   * `MongoClient` behaves that way, and specs clean their data up after `module.close()`. Production keeps
   * the default, where module destruction is the single shutdown point.
   */
  async onModuleDestroy(): Promise<void> {
    /**
     * It keeps the **pool** alive, nothing else: skipping the whole shutdown leaves the `LISTEN` handlers and
     * the sweeper's timer running, and with a shared client that is cumulative — every module ever created
     * keeps draining, including the ones whose pool has closed.
     */
    if (this.closeOnDestroy === false) {
      await this.driver.stopBackgroundWork().catch(() => {});
      return;
    }
    await this.close().catch(() => {});
  }

  private resolver: SchemaResolver = () => undefined;

  /** The URI it connected to, so a second module can join the same database as `getConnectionUri()` does. */
  connectionUri = "";

  private constructor(
    private pool: Pool,
    private driver: PostgresDatabase,
    readonly databaseName: string,
    /** Set only when this class opened the `LISTEN` connection itself; otherwise the caller closes it. */
    private ownedListenConnection?: ListenConnection,
    private closeOnDestroy = true
  ) {
    super();
  }

  /**
   * The pool's maximum size. Tests need it low: every module creates its own service, and a spec that does
   * not call `module.close()` keeps its pool, which exhausts `max_connections`. Production passes
   * `--database-pool-size`.
   */
  static async connect(
    uri: string,
    database: string,
    listenUri?: string,
    poolMax?: number,
    options: {
      closeOnDestroy?: boolean;
      idleTimeoutMillis?: number;
      /** A ready `LISTEN` client. **Ownership stays with the caller**: `close()` does not close it. */
      listenClient?: Client;
      /** The connection given to functions; that role's K-11 privileges are applied at startup. */
      functionsUri?: string;
    } = {}
  ): Promise<PostgresDatabaseService> {
    const pool = new Pool({
      connectionString: uri,
      ...(poolMax ? {max: poolMax} : {}),
      /** The idle connection lifetime; short when pools outlive their modules (see `closeOnDestroy`). */
      ...(options.idleTimeoutMillis ? {idleTimeoutMillis: options.idleTimeoutMillis} : {})
    });

    /**
     * A connection this class **owns** is kept alive across drops by `ListenConnection`, and the driver is
     * handed a function so it follows the replacement. A client someone else passed is left alone.
     */
    const ownsListenClient = !options.listenClient && !!listenUri;
    const owned = ownsListenClient ? await ListenConnection.open(listenUri!) : undefined;
    const listenClient = owned ? owned.current : options.listenClient;

    const service = new PostgresDatabaseService(
      pool,
      undefined as unknown as PostgresDatabase,
      database,
      owned,
      options.closeOnDestroy ?? true
    );

    service.driver = new PostgresDatabase(pool, database, {
      resolveSchema: name => service.resolver(name),
      changeStream: {listenClient}
    });

    service.connectionUri = uri;
    service.functionsUri = options.functionsUri;
    return service;
  }

  /** `BucketService` calls this at startup; it is the schema source. */
  setSchemaResolver(resolver: SchemaResolver): void {
    this.resolver = resolver;
  }

  get capabilities(): DriverCapabilities {
    return this.driver.capabilities;
  }

  /** Creates the schemas, the CDC outbox, the trigger functions and the system tables. Idempotent. */
  /** The connection given to functions; its privileges are applied in `bootstrap`. */
  functionsUri?: string;

  async bootstrap(): Promise<void> {
    // `LISTEN` is registered by the driver's own `bootstrap()`, so it is not repeated here.
    await this.driver.bootstrap();
    await this.schemaManager.bootstrap();
    await this.applyFunctionGrants();
  }

  /**
   * Applies the K-11 privileges to the function role.
   *
   * It runs **after** the schemas are created: `GRANT … ON ALL TABLES IN SCHEMA` raises on a schema that does
   * not exist. `ALTER DEFAULT PRIVILEGES` is here too, because bucket tables are created at runtime.
   *
   * With no role nothing happens, and that is a **closed** default: `@spica-devkit/postgres` then raises
   * rather than handing a function the API's fully privileged connection.
   */
  private async applyFunctionGrants(): Promise<void> {
    const role = roleFromUri(this.functionsUri);
    if (!role) return;

    /**
     * The role's existence is checked **first**, because `GRANT` on a missing role says `role "x" does not
     * exist`, which does not name the missing provisioning step. Spica does not create the role.
     */
    const {rows} = await this.pool.query<{exists: boolean}>(
      "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists",
      [role]
    );
    if (!rows[0]?.exists) {
      throw new Error(
        `--database-functions-uri names the role '${role}', but no such role exists in PostgreSQL. ` +
          `Spica grants privileges to that role, it does not create roles: create it first ` +
          `(CREATE ROLE "${role}" LOGIN PASSWORD '…') or point the option at an existing one.`
      );
    }

    /**
     * Two replicas starting together grant on the same objects, and concurrent `GRANT`s collide on the
     * catalog row (`tuple concurrently updated`) — contention, not a conflict of intent, so it is retried.
     */
    for (const statement of compileFunctionGrants(role)) {
      await runIdempotentDdl(this.pool, statement.sql, statement.params);
    }
  }

  collection<T = any>(name: string, options: CollectionOptions = {}): ICollection<T> {
    return this.driver.collection<T>(name, options);
  }

  createCollection<T = any>(name: string, options?: Record<string, any>): Promise<ICollection<T>> {
    return this.driver.createCollection(name, options) as Promise<ICollection<T>>;
  }

  listCollections(): Promise<{name: string}[]> {
    return this.driver.listCollections();
  }

  dropCollection(name: string): Promise<boolean> {
    return this.driver.dropCollection(name);
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  /**
   * The profiler is the `pg_stat_statements` extension, which is not guaranteed on a managed server, and
   * setting a profiling level is Mongo-specific in any case.
   */
  setProfilingLevel(): Promise<unknown> {
    throw new UnsupportedCapabilityError("setProfilingLevel()", "postgres");
  }

  indexes(collection: string): IIndexManager {
    return this.driver.indexes(collection);
  }

  private _schema?: PostgresSchemaManager;

  /**
   * The DDL planner. The `TransactionRunner` comes from the pool because the whole plan has to run inside **a
   * single transaction**, bound to one connection.
   */
  private get schemaManager(): PostgresSchemaManager {
    if (!this._schema) {
      this._schema = new PostgresSchemaManager(this.pool, {
        transaction: async work => {
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
      });
    }
    return this._schema;
  }

  schema(): ISchemaManager {
    return this.schemaManager;
  }

  /**
   * Aligns the physical schema after a bucket schema has changed. It lives here because this is the only
   * place with access to both the derived table definition and the DDL planner.
   *
   * **The order matters:** junction tables first, columns after. A new `onetoone` produces a column plus an
   * FK, and the FK's target table has to exist by then.
   */
  async alignCollection(name: string, previous?: LogicalSchema): Promise<void> {
    const to = this.driver.refreshTable(name);
    if (!to) {
      return;
    }

    if (!previous) {
      return;
    }

    // A bucket field whose type changes has its values cleared; the Mongo leg does the same with `$unset`.
    const plan = await this.schemaManager.plan(
      await this.driver.resolvable(bucketToTable(previous as Bucket)),
      await this.driver.resolvable(to),
      {clearOnTypeChange: true}
    );
    if (plan.changes.length) {
      await this.schemaManager.apply(plan);
    }
  }

  changeStream(): PostgresChangeStream {
    return this.driver.changeStream();
  }

  /** The retention sweep of the CDC outbox, handed over to the TTL sweeper. */
  startRetentionSweeper(changesRetentionSeconds: number): TtlSweeper {
    const sweeper = new TtlSweeper(this.pool, {schema: SYSTEM_SCHEMA});
    sweeper.register(changesRetention(changesRetentionSeconds));
    sweeper.start();
    return sweeper;
  }

  async close(): Promise<void> {
    // The driver closes both the background jobs and the pool; only the `LISTEN` connection is left here.
    await this.driver.close();
    await this.ownedListenConnection?.close();
  }
}

/**
 * Keeps an owned `LISTEN` connection alive across drops. `pg`'s `Client` does not reconnect and a lost
 * session takes the registration with it, after which change capture silently stays on the poll interval for
 * the life of the process.
 *
 * Recovery **replaces** the client rather than reviving it by writing `pg`'s private fields; the driver asks
 * through `current()` on every round, so it follows the replacement.
 *
 * The retry is deliberately dumb — one attempt per interval, no ladder, no cap: giving up would leave the
 * process on polling for good, and a backoff delays recovery from the common case of a quick restart.
 */
const LISTEN_RECONNECT_INTERVAL_MS = 1_000;

class ListenConnection {
  private client?: Client;
  private reconnecting = false;

  constructor(private uri: string) {}

  static async open(uri: string): Promise<ListenConnection> {
    const connection = new ListenConnection(uri);
    connection.client = await connection.connect();
    return connection;
  }

  current = (): Client | undefined => this.client;

  async close(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    await client?.end().catch(() => {});
  }

  private async connect(): Promise<Client> {
    const client = new Client({connectionString: this.uri});

    /**
     * An `error` on an idle client means the connection is gone, and there is no request to fail: without a
     * handler `pg` raises it as an unhandled error and takes the process down.
     */
    client.on("error", () => this.reconnect());

    await client.connect();
    return client;
  }

  private reconnect(): void {
    if (this.reconnecting || !this.client) return;
    this.reconnecting = true;

    const attempt = () => {
      // `close()` clears the client; a shutdown that lands mid-retry ends the loop rather than reopening.
      if (!this.client) {
        this.reconnecting = false;
        return;
      }

      this.connect()
        .then(client => {
          this.client = client;
          this.reconnecting = false;
        })
        .catch(() => setTimeout(attempt, LISTEN_RECONNECT_INTERVAL_MS).unref?.());
    };

    setTimeout(attempt, LISTEN_RECONNECT_INTERVAL_MS).unref?.();
  }
}
