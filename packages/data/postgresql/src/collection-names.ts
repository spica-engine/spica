import {Inject, Injectable} from "@nestjs/common";
import {ChangeOperation, CollectionNames, PG_POOL} from "@spica-server/interface-data";
import pg from "pg";
import {trackedTables} from "./change/tracked.js";
import {mainTableName} from "./schema/index.js";

@Injectable()
export class PostgresCollectionNames implements CollectionNames {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async list() {
    const [{rows: tables}, {rows: buckets}] = await Promise.all([
      this.pool.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename"
      ),
      this.pool.query("SELECT id FROM buckets")
    ]);
    const followable = new Set([
      ...trackedTables.map(({entity}) => entity.table),
      ...buckets.map(({id}) => mainTableName(String(id)))
    ]);
    return tables.map(row => row.tablename).filter(name => followable.has(name));
  }

  changeOperations(): ChangeOperation[] {
    return ["insert", "update", "delete"];
  }
}
