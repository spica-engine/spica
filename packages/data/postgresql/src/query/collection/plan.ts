import {BadRequestException} from "@nestjs/common";
import {assertFilterLanguage} from "@spica-server/data";
import {bind, Entity, quote, ResolvedColumn} from "@spica-server/data-postgresql-orm";
import {ReadSpec, WhereCondition} from "@spica-server/interface-data";
import {validate} from "uuid";
import {
  compileFilterIn,
  keyParser,
  resourceFilterCondition,
  RuleCompileError
} from "../../access/index.js";
import {CountPlan} from "../read.js";
import {ActiveRelations, joinSql, nameSql} from "./relations.js";
import {EntityFieldResolver, isSecret} from "./resolver.js";

export const ALIAS = "t";

export interface CollectionPlan {
  entity: Entity;
  values: unknown[];
  conditions: string[];
  joins: string[];
  conditionValues: number;
  matchesNothing: boolean;
  relations: ActiveRelations;
}

export const countPlanOf = (plan: CollectionPlan): CountPlan => ({
  table: plan.entity.table,
  alias: ALIAS,
  conditions: plan.conditions,
  joins: plan.joins,
  values: plan.values,
  conditionValues: plan.conditionValues
});

const idColumnOf = (entity: Entity) => entity.byProperty.get(entity.idProperty)!;

const reference = (column: ResolvedColumn) => `${quote(ALIAS)}.${quote(column.column)}`;

const MAX_UUID_V7_TIME = 2 ** 48 - 1;

function uuidAt(time: Date) {
  const milliseconds = Math.min(Math.max(time.getTime(), 0), MAX_UUID_V7_TIME);
  const hex = milliseconds.toString(16).padStart(12, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8)}-7000-8000-000000000000`;
}

function conditionOf(
  column: ResolvedColumn,
  expression: string,
  condition: WhereCondition,
  values: unknown[]
): string | undefined {
  const list = column.type.endsWith("[]");
  if ("in" in condition) {
    const wanted = condition.in.filter(value => column.type != "uuid" || validate(String(value)));
    return wanted.length
      ? `${expression} = ANY(${bind(values, wanted)}::${column.type}[])`
      : undefined;
  }
  if ("contains" in condition) {
    if (!list) {
      throw new BadRequestException("Only a list field can contain values.");
    }
    const {all, any} = condition.contains;
    return [
      all && `${expression} @> ${bind(values, all)}::${column.type}`,
      any && `${expression} && ${bind(values, any)}::${column.type}`
    ]
      .filter(Boolean)
      .join(" AND ");
  }
  if ("matches" in condition) {
    const operator = condition.caseInsensitive ? "~*" : "~";
    return `${expression} ${operator} ${bind(values, condition.matches)}::text`;
  }
  const value = condition.eq;
  if (list && !Array.isArray(value)) {
    throw new BadRequestException("A list field can only be compared with a list.");
  }
  if (column.type == "uuid" && !validate(String(value))) {
    return undefined;
  }
  return `${expression} = ${bind(values, value)}::${column.type}`;
}

export function planCollection(entity: Entity, spec: ReadSpec, relations: ActiveRelations) {
  assertFilterLanguage(spec.filter, ["expression"], "PostgreSQL");

  const values: unknown[] = [];
  const conditions: string[] = [];
  const joins: string[] = [];
  let matchesNothing = false;
  const idColumn = idColumnOf(entity);

  const names = new Map(relations.joined.map(relation => [relation.property, relation]));
  for (const relation of relations.joined) {
    const column = entity.byProperty.get(relation.property)!;
    joins.push(joinSql(relation, ALIAS, idColumnOf(relation.target).column, column.column));
  }

  if (spec.id !== undefined) {
    const id = String(spec.id);
    if (validate(id)) {
      conditions.push(`${reference(idColumn)} = ${bind(values, id)}::uuid`);
    } else {
      matchesNothing = true;
    }
  }

  const resourceFilter = spec.resourceFilter;
  if (resourceFilter?.include?.length || resourceFilter?.exclude?.length) {
    conditions.push(
      resourceFilterCondition(resourceFilter, keyParser("uuid")).sql(
        reference(idColumn),
        {type: "uuid"} as ResolvedColumn,
        values
      )
    );
  }

  for (const [field, condition] of Object.entries(spec.where ?? {})) {
    const column = entity.byProperty.get(field);
    if (!column || isSecret(entity, column)) {
      throw new BadRequestException(`"${field}" is not a field of the collection.`);
    }
    const related = names.get(field);
    const expression = related ? nameSql(related) : reference(column);
    const sql = conditionOf(
      related ? {...column, type: "text"} : column,
      expression,
      condition,
      values
    );
    if (sql) {
      conditions.push(sql);
    } else {
      matchesNothing = true;
    }
  }

  if (spec.createdBetween) {
    const {from, to} = spec.createdBetween;
    const created = entity.byProperty.get("created_at");
    const [column, low, high] = created
      ? [reference(created), from, to]
      : [reference(idColumn), uuidAt(from), uuidAt(to)];
    const type = created ? "timestamptz" : "uuid";
    conditions.push(
      `${column} >= ${bind(values, low)}::${type} AND ${column} < ${bind(values, high)}::${type}`
    );
  }

  if (typeof spec.filter == "string" && spec.filter.trim()) {
    try {
      const compiled = compileFilterIn(
        spec.filter,
        new EntityFieldResolver(entity, ALIAS, spec.hashed),
        values,
        undefined,
        spec.hashed?.secret
      );
      if (compiled.constant === false) {
        matchesNothing = true;
      } else if (compiled.constant === undefined) {
        conditions.push(`(${compiled.sql})`);
      }
    } catch (error) {
      throw error instanceof RuleCompileError ? new BadRequestException(error.message) : error;
    }
  }

  return {
    entity,
    values,
    conditions: conditions.map(condition => `(${condition})`),
    joins,
    conditionValues: values.length,
    matchesNothing,
    relations
  } satisfies CollectionPlan;
}

export function orderBy(entity: Entity, relations: ActiveRelations, sort?: object): string {
  const terms: string[] = [];
  const sorted = new Set<string>();
  const idColumn = idColumnOf(entity);

  for (const [property, direction] of Object.entries(sort ?? {})) {
    const column = entity.byProperty.get(property);
    if (!column || isSecret(entity, column)) {
      throw new BadRequestException(`Documents cannot be sorted by "${property}".`);
    }
    const related = relations.joined.find(relation => relation.property == property);
    const expression = related ? nameSql(related) : reference(column);
    if (!sorted.has(column.column)) {
      sorted.add(column.column);
      const order = Number(direction) == -1 ? "DESC NULLS LAST" : "ASC NULLS FIRST";
      terms.push(`${expression} ${order}`);
    }
  }
  if (!sorted.has(idColumn.column)) {
    terms.push(`${reference(idColumn)} ASC`);
  }
  return terms.join(", ");
}

function covers(path: string, column: ResolvedColumn) {
  return column.property == path || column.property.startsWith(`${path}.`);
}

export function projection(
  entity: Entity,
  relations: ActiveRelations,
  fields?: {[path: string]: 0 | 1}
): string {
  const entries = Object.entries(fields ?? {});
  const included = entries.filter(([, flag]) => Number(flag) == 1).map(([path]) => path);
  const excluded = entries.filter(([, flag]) => Number(flag) == 0).map(([path]) => path);
  const id = idColumnOf(entity);

  const columns = entity.columns.filter(column => {
    if (included.length) {
      return (
        (column == id && !excluded.includes(entity.idProperty)) ||
        included.some(path => covers(path, column))
      );
    }
    return !excluded.some(path => covers(path, column));
  });

  return (columns.length ? columns : [id])
    .map(column => {
      const related = relations.joined.find(relation => relation.property == column.property);
      return related
        ? `${nameSql(related)} AS ${quote(column.column)}`
        : `${reference(column)} AS ${quote(column.column)}`;
    })
    .join(", ");
}
