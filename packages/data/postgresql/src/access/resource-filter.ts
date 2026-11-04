import {bind, Condition, InlineValues, literalOf} from "@spica-server/data-postgresql-orm";
import {ResourceFilterSpec} from "@spica-server/interface-data";
import {keyIdType} from "../id.js";
import {KeyType} from "../schema/primary-key.js";

export type KeyValue = string | number;

export type KeyParser = (id: string) => KeyValue;

export function keyParser(type: KeyType): KeyParser {
  const idType = keyIdType(type);
  return id => idType.parse(id) as unknown as KeyValue;
}

function distinct(ids: string[], parse: KeyParser): KeyValue[] {
  return Array.from(new Set(ids.map(parse)));
}

function arrayOf(values: unknown[], items: KeyValue[], type: string) {
  if (values instanceof InlineValues) {
    return `ARRAY[${items.map(item => literalOf(item)).join(", ")}]::${type}[]`;
  }
  return `${bind(values, items)}::${type}[]`;
}

/**
 * Every exclude list and the include list are alternatives of each other: an id passes when any
 * one of them lets it through. A filter without any of them allows every row.
 */
export function resourceFilterCondition(
  filter: ResourceFilterSpec | undefined,
  parse: KeyParser
): Condition {
  const excludes = (filter?.exclude ?? []).map(exclude => distinct(exclude, parse));
  const include = distinct(filter?.include ?? [], parse);

  return new Condition((column, spec, values) => {
    const alternatives = excludes.map(
      exclude => `${column} <> ALL(${arrayOf(values, exclude, spec.type)})`
    );
    if (include.length) {
      alternatives.push(`${column} = ANY(${arrayOf(values, include, spec.type)})`);
    }
    return alternatives.length ? `(${alternatives.join(" OR ")})` : "TRUE";
  });
}
