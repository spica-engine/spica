import {quote} from "@spica-server/data-postgresql-orm";
import {ColumnType} from "../metadata/index.js";

interface ConversionRule {
  when(from: ColumnType, to: ColumnType): boolean;
  sql(value: string, from: ColumnType, to: ColumnType): string;
}

const isWhole = (type: ColumnType) => type == "integer" || type == "bigint";

const RULES: ConversionRule[] = [
  {
    when: (_, to) => to == "text",
    sql: (value, from) => (from == "jsonb" ? `${value} #>> '{}'` : `${value}::text`)
  },
  {
    when: (_, to) => to == "jsonb",
    sql: value => `to_jsonb(${value})`
  },
  {
    when: (from, to) => from == "integer" && to == "bigint",
    sql: value => `${value}::bigint`
  },
  {
    when: (from, to) => isWhole(from) && to == "double precision",
    sql: value => `${value}::double precision`
  },
  {
    when: (from, to) => from == "bigint" && to == "integer",
    sql: value => `CASE WHEN ${value} BETWEEN -2147483648 AND 2147483647 THEN ${value}::integer END`
  },
  {
    when: (from, to) => from == "double precision" && isWhole(to),
    sql: (value, _, to) => `CASE WHEN ${value} = trunc(${value}) THEN ${value}::${to} END`
  },
  {
    when: () => true,
    sql: (value, _, to) =>
      `CASE WHEN pg_input_is_valid(${value}::text, '${to}') THEN ${value}::text::${to} END`
  }
];

export function conversionSql(column: string, from: ColumnType, to: ColumnType) {
  const value = quote(column);
  return RULES.find(rule => rule.when(from, to)).sql(value, from, to);
}
