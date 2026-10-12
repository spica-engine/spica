import {DynamicModule, Global, Module, Provider} from "@nestjs/common";
import {MongoClient, MongoClientOptions} from "mongodb";
import {DatabaseService} from "./database.service.js";
import {MongoDatabase} from "../mongo/src/mongo.database.js";

export type Backend = "mongodb" | "postgres";

export interface ConnectionOptions extends Partial<MongoClientOptions> {
  database: string;
  changeStreamAwaitTimeMS?: number;
  /**
   * A direct connection that bypasses the pooler, for `LISTEN` on PostgreSQL. It cannot be taken from
   * the pool because it is session bound; without it CDC runs on polling alone and correctness is
   * unchanged (Phase 5).
   */
  listenUri?: string;
  /**
   * The PostgreSQL connection given to functions (K-11). When it is supplied, that role's privileges are
   * applied at startup: DML on `bucket`/`rel`, read-only on `spica`, full privileges on `app`.
   *
   * Spica does **not** create the role — the `CREATEROLE` that `CREATE ROLE` requires is not in the
   * privilege list we ask for. The role is created by the provisioning layer, Spica only applies the
   * `GRANT`s.
   */
  functionsUri?: string;
}

/**
 * The backend from the URI scheme. **No silent default** (K-5): an unrecognized scheme raises at
 * startup, because silently connecting to the wrong backend is the easiest way to split the data in two.
 */
export function backendFromUri(uri: string): Backend {
  const scheme = /^([a-zA-Z0-9+.-]+):\/\//.exec(uri || "")?.[1]?.toLowerCase();

  switch (scheme) {
    case "mongodb":
    case "mongodb+srv":
      return "mongodb";
    case "postgres":
    case "postgresql":
      return "postgres";
    default:
      throw new Error(
        `Unsupported --database-uri scheme ${scheme ? `'${scheme}'` : "(missing)"}. ` +
          `Use mongodb:// or mongodb+srv:// for MongoDB, postgres:// or postgresql:// for PostgreSQL.`
      );
  }
}

@Global()
@Module({})
export class DatabaseModule {
  static withConnection(uri: string, options: ConnectionOptions): DynamicModule {
    const backend = backendFromUri(uri);
    const {database, changeStreamAwaitTimeMS, listenUri, functionsUri, ...driverOptions} = options;

    /**
     * The selection goes through `await import()`: `pg` (and the reverse) is never brought into memory
     * in Mongo installations. Because both drivers are in the same image there is no installation step
     * and no version mismatch (K-9).
     */
    const dbProvider: Provider[] = [
      {
        provide: DatabaseService,
        useFactory: async (): Promise<DatabaseService> => {
          const service =
            backend === "mongodb"
              ? await connectMongo(uri, database, driverOptions)
              : await connectPostgres(uri, database, listenUri, functionsUri);

          service.changeStreamAwaitTimeMS = changeStreamAwaitTimeMS;
          return service;
        }
      }
    ];

    return {
      module: DatabaseModule,
      providers: dbProvider,
      exports: dbProvider
    };
  }
}

async function connectMongo(
  uri: string,
  database: string,
  options: Partial<MongoClientOptions>
): Promise<DatabaseService> {
  const client = await MongoClient.connect(uri, options);
  return new MongoDatabase(client.db(database));
}

/**
 * The PostgreSQL connection **and the startup setup** (Phase 6 item 3).
 *
 * `bootstrap()` lives here, inside the provider factory: it is idempotent (`IF NOT EXISTS`) and runs once
 * at API startup. The schemas, the system tables (AK-8), the CDC outbox and the trigger functions are
 * created in this step — opening the panel triggers no schema operation at all (K-8).
 *
 * There is no counterpart on MongoDB, because collections appear by themselves on the first write; on a
 * relational backend the table has to exist beforehand.
 */
async function connectPostgres(
  uri: string,
  database: string,
  listenUri?: string,
  functionsUri?: string
): Promise<DatabaseService> {
  const {PostgresDatabaseService} = await import("../postgres-adapter/index.js");
  const service = await PostgresDatabaseService.connect(uri, database, listenUri, undefined, {
    functionsUri
  });
  await service.bootstrap();
  return service;
}
