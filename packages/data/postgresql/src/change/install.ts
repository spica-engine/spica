import pg from "pg";
import {changeFunctionStatements, createChangeTriggerSql} from "./sql.js";
import {trackedTables} from "./tracked.js";

const CHANGE_LOCK = "spica_change_function";

export const systemTriggerStatements = () =>
  trackedTables.map(({entity, beforeColumns}) =>
    createChangeTriggerSql(entity.table, {
      target: entity.table,
      keyColumn: entity.byProperty.get(entity.idProperty)!.column,
      beforeColumns
    })
  );

export async function installChangeSupport(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [CHANGE_LOCK]);
    for (const statement of [...changeFunctionStatements, ...systemTriggerStatements()]) {
      await client.query(statement);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
