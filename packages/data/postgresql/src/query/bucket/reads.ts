import {quote, Session} from "@spica-server/data-postgresql-orm";
import {visibilitySelect} from "../../access/index.js";
import {KeyType, SYSTEM_COLUMNS} from "../../schema/index.js";
import {ReadPlan, TABLE} from "./plan.js";

type Row = Record<string, unknown>;

export interface Paging {
  limit?: number;
  skip?: number;
}

const READ_TIMEOUT_MS = 30_000;

const SNAPSHOT_THAT_CANNOT_WRITE = "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY";

const STOP_STATEMENTS_THAT_RUN_AWAY = "SELECT set_config('statement_timeout', $1, true)";

const ROWS_THE_PLANNER_EXPECTS =
  "SELECT reltuples::bigint AS estimate FROM pg_class WHERE oid = to_regclass($1)";

const whereOf = (conditions: string[]) =>
  conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

function selectPage(plan: ReadPlan, order: string, paging: Paging) {
  const values = [...plan.values];
  const limits: string[] = [];
  if (Number(paging.limit) > 0) {
    values.push(Number(paging.limit));
    limits.push(`LIMIT $${values.length}`);
  }
  if (Number(paging.skip) > 0) {
    values.push(Number(paging.skip));
    limits.push(`OFFSET $${values.length}`);
  }

  const joins = [...new Set([...plan.joins, ...(plan.fieldRules?.joins ?? [])])];
  const visibility = plan.fieldRules ? visibilitySelect(plan.fieldRules) : [];
  const columns = [`${quote(TABLE)}.*`, ...visibility].join(", ");

  const text = `SELECT ${columns} FROM ${quote(plan.metadata.main.name)} AS ${quote(TABLE)} ${joins.join(" ")} ${whereOf(plan.conditions)} ORDER BY ${order} ${limits.join(" ")}`;
  return {text, values};
}

function selectChildren(table: string, parentType: KeyType) {
  return `SELECT * FROM ${quote(table)} WHERE ${quote(SYSTEM_COLUMNS.parent)} = ANY($1::${parentType}[])`;
}

function selectByKeys(table: string, keyColumn: string, keyType: KeyType) {
  return `SELECT * FROM ${quote(table)} WHERE ${quote(keyColumn)} = ANY($1::${keyType}[])`;
}

function countMatching(plan: ReadPlan) {
  const text = `SELECT COUNT(*) AS total FROM ${quote(plan.metadata.main.name)} AS ${quote(TABLE)} ${plan.joins.join(" ")} ${whereOf(plan.conditions)}`;
  return {text, values: plan.values.slice(0, plan.conditionValues)};
}

export class BucketReads {
  constructor(private readonly session: Session) {}

  async restrictToReading() {
    await this.session.raw(SNAPSHOT_THAT_CANNOT_WRITE);
    await this.session.raw(STOP_STATEMENTS_THAT_RUN_AWAY, [String(READ_TIMEOUT_MS)]);
  }

  async page(plan: ReadPlan, order: string, paging: Paging): Promise<Row[]> {
    const {text, values} = selectPage(plan, order, paging);
    return (await this.session.raw<Row>(text, values)).rows;
  }

  async childRows(table: string, parentType: KeyType, parents: unknown[]): Promise<Row[]> {
    return (await this.session.raw<Row>(selectChildren(table, parentType), [parents])).rows;
  }

  async rowsWithKeys(
    table: string,
    keyColumn: string,
    keyType: KeyType,
    keys: unknown[]
  ): Promise<Row[]> {
    return (await this.session.raw<Row>(selectByKeys(table, keyColumn, keyType), [keys])).rows;
  }

  async plannerEstimate(table: string): Promise<number> {
    const {rows} = await this.session.raw(ROWS_THE_PLANNER_EXPECTS, [quote(table)]);
    return Number(rows[0]?.estimate ?? -1);
  }

  async countMatching(plan: ReadPlan): Promise<number> {
    const {text, values} = countMatching(plan);
    const {rows} = await this.session.raw(text, values);
    return Number(rows[0].total);
  }
}
