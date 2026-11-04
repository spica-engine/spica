import {InvalidIdError} from "@spica-server/data";
import {bind, Condition, InlineValues, literalOf} from "@spica-server/data-postgresql-orm";
import {ResourceFilterSpec} from "@spica-server/interface-data";
import {UuidV7Type} from "../id.js";
import {KeyType} from "../schema/primary-key.js";

export type KeyValue = string | number;

export type KeyParser = (id: string) => KeyValue;

const INTEGER_RANGE = {min: -(2n ** 31n), max: 2n ** 31n - 1n};
const BIGINT_RANGE = {min: -(2n ** 63n), max: 2n ** 63n - 1n};

function parseWhole(id: string, type: KeyType, range: {min: bigint; max: bigint}): bigint {
  if (typeof id != "string" || !/^-?\d+$/.test(id)) {
    throw new InvalidIdError(`"${String(id)}" is not a valid ${type}.`);
  }
  const value = BigInt(id);
  if (value < range.min || value > range.max) {
    throw new InvalidIdError(`"${id}" is out of the ${type} range.`);
  }
  return value;
}

export function keyParser(type: KeyType): KeyParser {
  switch (type) {
    case "uuid": {
      const uuid = new UuidV7Type();
      return id => uuid.parse(id);
    }
    case "integer":
      return id => Number(parseWhole(id, type, INTEGER_RANGE));
    case "bigint":
      // bigint stays a string so it survives the driver without losing precision.
      return id => parseWhole(id, type, BIGINT_RANGE).toString();
    case "text":
      return id => {
        if (typeof id != "string") {
          throw new InvalidIdError(`"${String(id)}" is not a valid text key.`);
        }
        return id;
      };
  }
}

function distinct(ids: string[], parse: KeyParser): KeyValue[] {
  return Array.from(new Set(ids.map(parse)));
}

function arrayOf(values: unknown[], items: KeyValue[], type: string) {
  if (values instanceof InlineValues) {
    return `ARRAY[${items.map(literalOf).join(", ")}]::${type}[]`;
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
