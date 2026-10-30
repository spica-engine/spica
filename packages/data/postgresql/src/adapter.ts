import {Logger, Module, OnApplicationShutdown, Inject} from "@nestjs/common";
import {DataAdapter, PassthroughResultShaper} from "@spica-server/data";
import {createTables, Orm} from "@spica-server/data-postgresql-orm";
import {
  COLLECTION_NAMES,
  COLLECTION_QUERY,
  DATA_HEALTH,
  ID_TYPES,
  PG_POOL,
  REPOSITORY_CLASSES,
  RESULT_SHAPER
} from "@spica-server/interface-data";
import pg from "pg";
import {PostgresCollectionNames} from "./collection-names.js";
import {systemEntities} from "./entities/index.js";
import {PostgresExpiry} from "./expiry/index.js";
import {PostgresDataHealth} from "./health.js";
import {PostgresIdTypes} from "./id.js";
import {ORM} from "./orm.js";
import {UnsupportedCollectionQueryFacade} from "./query.js";
import {repositoryClasses} from "./repositories/index.js";
import {postgresBucketSchema} from "./schemas/index.js";
import {BUCKET_SCHEMA_EXTENSION} from "@spica-server/interface-bucket";
import {assertSupportedServerVersion} from "./version.js";

export const POSTGRESQL_ENGINE = "postgresql";

export type PostgresUri = string | (() => Promise<string>);

export interface PostgresConnectionOptions {
  poolSize?: number;
}

const logger = new Logger("PostgresDataAdapter");

export async function connect(uri: string, options: PostgresConnectionOptions = {}) {
  const pool = new pg.Pool({
    connectionString: uri,
    max: options.poolSize
  });
  pool.on("error", error => logger.error(`Idle PostgreSQL client failed: ${error.message}`));
  try {
    const {rows} = await pool.query("SHOW server_version_num");
    assertSupportedServerVersion(rows[0].server_version_num);
    const cron = await pool.query("SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'");
    if (!cron.rowCount) {
      logger.warn("The pg_cron extension is not available on this PostgreSQL server.");
    }
  } catch (error) {
    await pool.end();
    throw error;
  }
  return pool;
}

async function connectWithSystemTables(uri: string, options: PostgresConnectionOptions) {
  const pool = await connect(uri, options);
  try {
    await createTables(pool, systemEntities);
  } catch (error) {
    await pool.end();
    throw error;
  }
  return pool;
}

@Module({})
export class PostgresDataAdapterModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

export class PostgresDataAdapter {
  static forRoot(uri: PostgresUri, options: PostgresConnectionOptions = {}): DataAdapter {
    return {
      engine: POSTGRESQL_ENGINE,
      module: {
        module: PostgresDataAdapterModule,
        providers: [
          {
            provide: PG_POOL,
            useFactory: async () =>
              connectWithSystemTables(typeof uri == "function" ? await uri() : uri, options)
          },
          {provide: ORM, useFactory: (pool: pg.Pool) => new Orm(pool), inject: [PG_POOL]},
          PostgresExpiry,
          {provide: ID_TYPES, useClass: PostgresIdTypes},
          {provide: RESULT_SHAPER, useClass: PassthroughResultShaper},
          {provide: COLLECTION_QUERY, useClass: UnsupportedCollectionQueryFacade},
          {provide: BUCKET_SCHEMA_EXTENSION, useValue: postgresBucketSchema},
          {provide: REPOSITORY_CLASSES, useValue: repositoryClasses},
          {provide: COLLECTION_NAMES, useClass: PostgresCollectionNames},
          {provide: DATA_HEALTH, useClass: PostgresDataHealth}
        ],
        exports: [
          PG_POOL,
          ORM,
          PostgresExpiry,
          ID_TYPES,
          RESULT_SHAPER,
          COLLECTION_QUERY,
          BUCKET_SCHEMA_EXTENSION,
          REPOSITORY_CLASSES,
          COLLECTION_NAMES,
          DATA_HEALTH
        ]
      }
    };
  }
}
