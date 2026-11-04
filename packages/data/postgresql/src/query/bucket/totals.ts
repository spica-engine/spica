import {quote, Session} from "@spica-server/data-postgresql-orm";
import {ReadPlan, TABLE} from "./plan.js";

// Below this the planner's estimate can be far off, and counting is cheap.
const ESTIMATE_FROM_ROWS = 10_000;

export async function countTotal(session: Session, plan: ReadPlan): Promise<number> {
  const table = plan.metadata.main.name;

  if (!plan.conditions.length) {
    const {rows} = await session.raw(
      "SELECT reltuples::bigint AS estimate FROM pg_class WHERE oid = to_regclass($1)",
      [quote(table)]
    );
    const estimate = Number(rows[0]?.estimate ?? -1);
    if (estimate >= ESTIMATE_FROM_ROWS) {
      return estimate;
    }
  }

  const where = plan.conditions.length ? `WHERE ${plan.conditions.join(" AND ")}` : "";
  const {rows} = await session.raw(
    `SELECT COUNT(*) AS total FROM ${quote(table)} AS ${quote(TABLE)} ${plan.joins.join(" ")} ${where}`,
    plan.values.slice(0, plan.conditionValues)
  );
  return Number(rows[0].total);
}
