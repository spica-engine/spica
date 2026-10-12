import {DynamicModule, Global, Module} from "@nestjs/common";
import {DatabaseService, MongoDatabase, MongoClient} from "@spica-server/database";
import {start, connect, getConnectionUri, getDatabaseName} from "./start";
import {
  createPostgresDatabase,
  getPostgresListenClient,
  registerPostgresService,
  startPostgres
} from "./start-postgres.js";

/**
 * Which backend the tests run on; the CI matrix sets it.
 *
 * **Why an environment variable:** hundreds of specs call `replicaSet()`/`standalone()`, and editing each one
 * to open the second leg would be a permanent fork. With the factory choosing, the specs do not change and
 * both legs run the same code.
 */
function selectedBackend(): "mongodb" | "postgres" {
  const value = (process.env.SPICA_TEST_BACKEND || "mongodb").toLowerCase();
  if (value !== "mongodb" && value !== "postgres") {
    throw new Error(
      `Unsupported SPICA_TEST_BACKEND '${value}'. Use 'mongodb' (default) or 'postgres'.`
    );
  }
  return value;
}

@Global()
@Module({})
export class DatabaseTestingModule {
  /** On the PostgreSQL leg `standalone` and `replicaSet` are the same: the topology is Mongo-specific. */
  static standalone(dbName?: string): DynamicModule {
    if (selectedBackend() === "postgres") return DatabaseTestingModule.postgres();
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoClient,
          useFactory: async () => start("standalone")
        },
        {
          provide: DatabaseService,
          useFactory: async (client: MongoClient) =>
            new MongoDatabase(client.db(dbName || getDatabaseName())),
          inject: [MongoClient]
        }
      ],
      exports: [MongoClient, DatabaseService]
    };
  }
  static replicaSet(dbName?: string): DynamicModule {
    if (selectedBackend() === "postgres") return DatabaseTestingModule.postgres();
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoClient,
          useFactory: async () => start("replset")
        },
        {
          provide: DatabaseService,
          useFactory: async (client: MongoClient) =>
            new MongoDatabase(client.db(dbName || getDatabaseName())),
          inject: [MongoClient]
        }
      ],
      exports: [MongoClient, DatabaseService]
    };
  }

  /**
   * The PostgreSQL leg: the **same contract** as its Mongo counterparts, a real driver behind the
   * `DatabaseService` token.
   *
   * `MongoClient` is **not provided** — the token is mongodb-specific, so a spec that injects it fails at
   * setup rather than misbehaving. The server comes up once per process and every module takes its own
   * database, which is the cheap way to isolate on PostgreSQL.
   */
  static postgres(): DynamicModule {
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: DatabaseService,
          useFactory: async () => {
            const base = await startPostgres();
            const uri = await createPostgresDatabase(base);
            const {PostgresDatabaseService} =
              await import("@spica-server/database/postgres-adapter");
            /**
             * A small pool (2): dozens of modules can be created per spec and the pool of the ones
             * that are not closed stays alive. With the default of 10 we were getting
             * `sorry, too many clients already`.
             */
            /**
             * The `LISTEN` client is **shared**. Without it the change stream falls back to 500 ms
             * polling only, and that created a silent latency difference between tests and production:
             * a spec that waits for a change synchronously (`schemas-realtime`'s "should listen
             * changes") failed on every run and the rest ran slower than they needed to. It is **not**
             * opened per module; the rationale is in `getPostgresListenClient`.
             */
            const service = await PostgresDatabaseService.connect(uri, "postgres", undefined, 2, {
              listenClient: await getPostgresListenClient(uri),
              /**
               * The pool **outlives** the Nest module, like the shared `MongoClient` on Mongo. Specs
               * clean data up with `db` after `module.close()` and, by notification order, that
               * cleanup can run after the module has shut down.
               *
               * The responsibility for closing passes to the general cleanup at the end of the file
               * via `registerPostgresService`; `idleTimeoutMillis` also keeps the accumulated pools
               * from holding connections on the server while idle (that was the source of R48).
               */
              closeOnDestroy: false,
              idleTimeoutMillis: 1_000
            });
            await service.bootstrap();

            /**
             * The pool is **registered**: in specs that do not call `module.close()`, `onModuleDestroy`
             * never runs and the pool stays alive. When the shared container shuts down those pools
             * produce `57P01 terminating connection due to administrator command` — 167 lines in the
             * `passport/user` log were that noise, and it hid the real failure count.
             *
             * The registry runs before `startPostgres`'s global cleanup, so the connections are closed
             * before the server stops.
             */
            registerPostgresService(service);
            return service;
          }
        }
      ],
      exports: [DatabaseService]
    };
  }

  /**
   * Joins the **same** database with a second module — the counterpart of the scenario where two
   * replicas share one database (`api/replication`'s commander spec sets this up).
   *
   * `connect(uri, dbName)` is Mongo-specific: it provides a `MongoClient` and takes the URI from
   * `getConnectionUri()`. On the PG leg that call tried to connect to a Mongo server that does not
   * exist and **hung**.
   *
   * The neutral path goes through the first module's service: on Mongo the shared client plus the same
   * database name, on PostgreSQL **a separate pool** to the same URI. The second is even closer to
   * production — every replica opens its own pool and the data is shared.
   */
  static join(database: DatabaseService): DynamicModule {
    if (selectedBackend() === "postgres") {
      const uri = (database as unknown as {connectionUri?: string}).connectionUri;
      if (!uri) {
        throw new Error(
          "DatabaseTestingModule.join needs a PostgreSQL service created by this testing module."
        );
      }

      return {
        module: DatabaseTestingModule,
        providers: [
          {
            provide: DatabaseService,
            useFactory: async () => {
              const {PostgresDatabaseService} =
                await import("@spica-server/database/postgres-adapter");
              // The shared `LISTEN` client is passed here too; the rationale is in `postgres()`.
              const service = await PostgresDatabaseService.connect(uri, "postgres", undefined, 2, {
                listenClient: await getPostgresListenClient(uri),
                closeOnDestroy: false,
                idleTimeoutMillis: 1_000
              });
              // No `bootstrap()`: the tables were created by the first module and, idempotent or
              // not, running it a second time is needless work.
              registerPostgresService(service);
              return service;
            }
          }
        ],
        exports: [DatabaseService]
      };
    }

    return DatabaseTestingModule.connect(getConnectionUri(), database.databaseName);
  }

  static connect(connectionUri: string, dbName?: string) {
    return {
      module: DatabaseTestingModule,
      providers: [
        {
          provide: MongoClient,
          useFactory: async () => connect(connectionUri)
        },
        {
          provide: DatabaseService,
          useFactory: async (client: MongoClient) =>
            new MongoDatabase(client.db(dbName || getDatabaseName())),
          inject: [MongoClient]
        }
      ],
      exports: [MongoClient, DatabaseService]
    };
  }
}
