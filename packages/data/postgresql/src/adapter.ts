import {Logger, Module, OnApplicationShutdown, Inject} from "@nestjs/common";
import {DataAdapter} from "@spica-server/data";
import {DATA_HEALTH, ID_TYPES, PG_POOL} from "@spica-server/interface-data";
import pg from "pg";
import {PostgresDataHealth} from "./health.js";
import {PostgresIdTypes} from "./id.js";
import {assertSupportedServerVersion} from "./version.js";

export const POSTGRESQL_ENGINE = "postgresql";

export type PostgresUri = string | (() => Promise<string>);

export interface PostgresConnectionOptions {
  poolSize?: number;
  ssl?: boolean;
}

const logger = new Logger("PostgresDataAdapter");

export async function connect(uri: string, options: PostgresConnectionOptions = {}) {
  const pool = new pg.Pool({
    connectionString: uri,
    max: options.poolSize,
    ssl: options.ssl ? {rejectUnauthorized: true} : undefined
  });
  try {
    const {rows} = await pool.query("SHOW server_version_num");
    assertSupportedServerVersion(rows[0].server_version_num);
    const cron = await pool.query(
      "SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'"
    );
    if (!cron.rowCount) {
      logger.warn("The pg_cron extension is not available on this PostgreSQL server.");
    }
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
          {provide: PG_POOL, useFactory: async () =>
              connect(typeof uri == "function" ? await uri() : uri, options)},
          {provide: ID_TYPES, useClass: PostgresIdTypes},
          {provide: DATA_HEALTH, useClass: PostgresDataHealth}
        ],
        exports: [PG_POOL, ID_TYPES, DATA_HEALTH]
      }
    };
  }
}
