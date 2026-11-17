import {Inject, Injectable} from "@nestjs/common";
import {DataHealth, PG_POOL} from "@spica-server/interface-data";
import type {Pool} from "pg";

@Injectable()
export class PostgresDataHealth implements DataHealth {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async ping() {
    await this.pool.query("SELECT 1");
  }
}
