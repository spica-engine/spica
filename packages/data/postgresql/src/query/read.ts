import {Logger} from "@nestjs/common";
import {DatabaseException} from "@spica-server/bucket-common";
import {Orm, quote, Session} from "@spica-server/data-postgresql-orm";

export interface CountPlan {
  table: string;
  alias: string;
  conditions: string[];
  joins: string[];
  values: unknown[];
  conditionValues: number;
}

const READ_TIMEOUT_MS = 30_000;
const QUERY_CANCELED = "57014";

const SNAPSHOT_THAT_CANNOT_WRITE = "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY";

const STOP_STATEMENTS_THAT_RUN_AWAY = "SELECT set_config('statement_timeout', $1, true)";

const ROWS_THE_PLANNER_EXPECTS =
  "SELECT reltuples::bigint AS estimate FROM pg_class WHERE oid = to_regclass($1)";

const logger = new Logger("PostgresQuery");

export const whereOf = (conditions: string[]) =>
  conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

function countMatching(plan: CountPlan) {
  const text = `SELECT COUNT(*) AS total FROM ${quote(plan.table)} AS ${quote(plan.alias)} ${plan.joins.join(" ")} ${whereOf(plan.conditions)}`;
  return {text, values: plan.values.slice(0, plan.conditionValues)};
}

export function databaseError(error: unknown): never {
  if (error instanceof Error && "status" in error) {
    throw error;
  }
  logger.error((error as Error)?.message);
  throw new DatabaseException(
    (error as {code?: string})?.code == QUERY_CANCELED
      ? "The query took too long."
      : "The query could not be completed."
  );
}

export class Reads {
  constructor(protected readonly session: Session) {}

  async restrictToReading() {
    await this.session.raw(SNAPSHOT_THAT_CANNOT_WRITE);
    await this.session.raw(STOP_STATEMENTS_THAT_RUN_AWAY, [String(READ_TIMEOUT_MS)]);
  }

  async plannerEstimate(table: string): Promise<number> {
    const {rows} = await this.session.raw(ROWS_THE_PLANNER_EXPECTS, [quote(table)]);
    return Number(rows[0]?.estimate ?? -1);
  }

  async countMatching(plan: CountPlan): Promise<number> {
    const {text, values} = countMatching(plan);
    const {rows} = await this.session.raw(text, values);
    return Number(rows[0].total);
  }
}

export async function readOnly<Q extends Reads, R>(
  orm: Orm,
  open: (session: Session) => Q,
  work: (reads: Q) => Promise<R>
): Promise<R> {
  try {
    return await orm.transaction(async session => {
      const reads = open(session);
      await reads.restrictToReading();
      return work(reads);
    });
  } catch (error) {
    return databaseError(error);
  }
}
