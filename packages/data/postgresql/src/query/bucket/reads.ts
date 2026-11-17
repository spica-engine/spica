import {quote} from "@spica-server/data-postgresql-orm";
import {visibilitySelect} from "../../access/index.js";
import {KeyType, SYSTEM_COLUMNS} from "../../schema/index.js";
import {Reads, whereOf} from "../read.js";
import {ReadPlan, TABLE} from "./plan.js";

type Row = Record<string, unknown>;

export interface Paging {
  limit?: number;
  skip?: number;
}

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

export class BucketReads extends Reads {
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
}
