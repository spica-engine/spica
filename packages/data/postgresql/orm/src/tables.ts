import pg from "pg";
import {Entity} from "./entity.js";
import {createIndexSql, createTableSql} from "./sql.js";

export const TABLES_LOCK_NAME = "spica_system_tables";

export async function createTables(pool: pg.Pool, entities: readonly Entity[]) {
  const client = await pool.connect();
  let unlockFailed = false;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [TABLES_LOCK_NAME]);
    try {
      for (const entity of entities) {
        await client.query(createTableSql(entity));
        for (const index of entity.indexes) {
          await client.query(createIndexSql(entity, index));
        }
      }
    } finally {
      await client
        .query("SELECT pg_advisory_unlock(hashtext($1))", [TABLES_LOCK_NAME])
        .catch(error => {
          unlockFailed = true;
          throw error;
        });
    }
  } finally {
    client.release(unlockFailed);
  }
}
