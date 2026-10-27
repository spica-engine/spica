import {Inject, Injectable} from "@nestjs/common";
import {CollectionNames, PG_POOL} from "@spica-server/interface-data";
import pg from "pg";

@Injectable()
export class PostgresCollectionNames implements CollectionNames {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async list() {
    const {rows} = await this.pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename"
    );
    return rows.map(row => row.tablename);
  }
}
