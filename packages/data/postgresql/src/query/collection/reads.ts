import {Entity, quote} from "@spica-server/data-postgresql-orm";
import {ReadSpec} from "@spica-server/interface-data";
import {Reads, whereOf} from "../read.js";
import {ALIAS, CollectionPlan, orderBy, projection} from "./plan.js";

type Row = Record<string, unknown>;

function selectPage(plan: CollectionPlan, spec: ReadSpec) {
  const values = [...plan.values];
  const limits: string[] = [];
  if (Number(spec.limit) > 0) {
    values.push(Number(spec.limit));
    limits.push(`LIMIT $${values.length}`);
  }
  if (Number(spec.skip) > 0) {
    values.push(Number(spec.skip));
    limits.push(`OFFSET $${values.length}`);
  }
  const {entity, relations} = plan;
  const columns = projection(entity, relations, spec.fields);
  const order = orderBy(entity, relations, spec.sort);
  const text = `SELECT ${columns} FROM ${quote(entity.table)} AS ${quote(ALIAS)} ${plan.joins.join(" ")} ${whereOf(plan.conditions)} ORDER BY ${order} ${limits.join(" ")}`;
  return {text, values};
}

function selectByIds(entity: Entity) {
  const idColumn = entity.byProperty.get(entity.idProperty)!.column;
  return `SELECT * FROM ${quote(entity.table)} WHERE ${quote(idColumn)} = ANY($1::uuid[])`;
}

export class CollectionReads extends Reads {
  async page(plan: CollectionPlan, spec: ReadSpec): Promise<Row[]> {
    const {text, values} = selectPage(plan, spec);
    return (await this.session.raw<Row>(text, values)).rows;
  }

  async rowsWithIds(entity: Entity, ids: string[]): Promise<Row[]> {
    return (await this.session.raw<Row>(selectByIds(entity), [ids])).rows;
  }
}
