import {Inject, Injectable} from "@nestjs/common";
import {Entity, expireSql} from "@spica-server/data-postgresql-orm";
import {PG_POOL} from "@spica-server/interface-data";
import pg from "pg";

export const EXPIRY_SCHEDULE = "* * * * *";

const SCHEDULE_LOCK = "spica_expiry_schedule";

@Injectable()
export class PostgresExpiry {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async expire(entity: Entity, property: string, afterSeconds: number) {
    const command = expireSql(entity, property, afterSeconds);
    const {
      rows: [{database, cron}]
    } = await this.pool.query(
      "SELECT current_database() AS database, current_setting('cron.database_name', true) AS cron"
    );
    if (!cron) {
      throw missingPgCron("pg_cron is not preloaded by the server");
    }

    const client = new pg.Client({connectionString: this.cronConnectionString(cron)});
    await client.connect();
    try {
      const {rowCount} = await client.query("SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'");
      if (!rowCount) {
        throw missingPgCron(`the extension does not exist in the "${cron}" database`);
      }
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [SCHEDULE_LOCK]);
      await client.query("SELECT cron.schedule_in_database($1, $2, $3, $4)", [
        `spica:${database}:${entity.table}`,
        EXPIRY_SCHEDULE,
        command,
        database
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      await client.end();
    }
  }

  private cronConnectionString(database: string) {
    const uri = new URL(this.pool.options.connectionString as string);
    uri.pathname = `/${encodeURIComponent(database)}`;
    return uri.toString();
  }
}

const missingPgCron = (reason: string) =>
  new Error(
    `PostgreSQL needs pg_cron to expire records, but ${reason}. Run the spicaengine/postgres image, or create the extension as a superuser and grant the application role USAGE on schema cron and EXECUTE on cron.schedule_in_database.`
  );
