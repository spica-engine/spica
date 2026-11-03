import {hash} from "@spica-server/core-encryption";
import {validate} from "uuid";
import {ColumnType} from "../../schema/metadata/types.js";
import {Constant, Property} from "./operands.js";
import {UnsupportedRuleError} from "./errors.js";

export interface Coerced {
  value: unknown;
  cast: ColumnType;
}

const INT8 = {min: -(2n ** 63n), max: 2n ** 63n - 1n};
const WHOLE = /^-?\d+$/;

function whole(value: string): string | undefined {
  if (!WHOLE.test(value)) {
    return undefined;
  }
  const parsed = BigInt(value);
  return parsed >= INT8.min && parsed <= INT8.max ? parsed.toString() : undefined;
}

function numeric(value: unknown, type: ColumnType): Coerced | undefined {
  if (typeof value == "number" && Number.isFinite(value)) {
    return {value, cast: Number.isSafeInteger(value) ? "bigint" : "double precision"};
  }
  if (typeof value == "string" && type == "bigint") {
    const normalized = whole(value);
    return normalized === undefined ? undefined : {value: normalized, cast: "bigint"};
  }
  return undefined;
}

// Only a literal in the rule is converted, never a value taken from auth, as in the MongoDB replacers.
function convertLiteral(value: string, property: Property, hashSecret?: string): string {
  return property.type == "hash" && hashSecret ? hash(value, hashSecret) : value;
}

export function coerceConstant(
  constant: Constant,
  column: {type: ColumnType; property?: Property},
  hashSecret?: string
): Coerced | undefined {
  const {type, property} = column;
  let {value} = constant;

  if (constant.literal && typeof value == "string" && property) {
    value = convertLiteral(value, property, hashSecret);
  }

  switch (type) {
    case "text":
      return typeof value == "string" ? {value, cast: type} : undefined;
    case "uuid":
      return typeof value == "string" && validate(value)
        ? {value: value.toLowerCase(), cast: type}
        : undefined;
    case "integer":
    case "bigint":
    case "double precision":
      return numeric(value, type);
    case "boolean":
      return typeof value == "boolean" ? {value, cast: type} : undefined;
    case "timestamptz":
      if (value instanceof Date) {
        return {value, cast: type};
      }
      if (typeof value == "string" && constant.literal) {
        if (isNaN(Date.parse(value))) {
          throw new UnsupportedRuleError(`"${value}" is not a date the rule can compare with.`);
        }
        return {value: new Date(value), cast: type};
      }
      return undefined;
    default:
      throw new UnsupportedRuleError(`A ${type} field cannot be compared in a rule.`);
  }
}
