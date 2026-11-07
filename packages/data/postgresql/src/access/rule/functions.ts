import {ColumnType} from "../../schema/metadata/types.js";
import {coerceConstant} from "./coerce.js";
import {InvalidRuleError, UnsupportedRuleError} from "./errors.js";
import {ArrayField, childRows, elementColumn, RuleContext} from "./fields.js";
import {Column, constant, Expression, Operand, Scalar} from "./operands.js";

type Node = any;

type Target = Column | ArrayField | {kind: "auth"; value: unknown};

interface Item {
  value: unknown;
  literal: boolean;
}

export interface FunctionHost {
  context: RuleContext;
  param(value: unknown, listOf?: ColumnType): string;
  alias(): string;
  target(node: Node): Target;
}

type Implementation = (args: Node[], host: FunctionHost) => Operand;

const INT4 = {min: -(2 ** 31), max: 2 ** 31 - 1};

const expression = (sql: string, type: ColumnType): Expression => ({
  kind: "expression",
  sql,
  type,
  twoValued: true
});

function arity(name: string, args: Node[], min: number, max = min) {
  if (args.length >= min && args.length <= max) {
    return;
  }
  const found = `but found ${args.length}.`;
  throw new InvalidRuleError(
    min == max
      ? `Function '${name}' accepts exactly ${min} argument(s) ${found}`
      : args.length < min
        ? `Function '${name}' accepts minimum ${min} argument(s) ${found}`
        : `Function '${name}' accepts maximum ${max} argument(s) ${found}`
  );
}

const isPath = (node: Node) =>
  !Array.isArray(node) && node.kind == "operator" && node.type == "select";

function requirePath(name: string, args: Node[], index: number) {
  if (!isPath(args[index])) {
    throw new InvalidRuleError(`Function '${name}' arg[${index}] must be property access chain.`);
  }
}

function requireString(name: string, args: Node[], index: number): string {
  const node = args[index];
  if (Array.isArray(node) || node.kind != "literal") {
    throw new InvalidRuleError(`Function '${name}' arg[${index}] must be literal.`);
  }
  if (typeof node.value != "string") {
    throw new InvalidRuleError(`Function '${name}' arg[${index}] must be a string.`);
  }
  return node.value;
}

function has(args: Node[], host: FunctionHost): Operand {
  arity("has", args, 1);
  requirePath("has", args, 0);
  const target = host.target(args[0]);
  if (target.kind == "auth") {
    return constant(target.value !== undefined && target.value !== null);
  }
  if (target.kind == "array") {
    const alias = host.alias();
    return expression(`EXISTS (SELECT 1 ${childRows(target, alias)})`, "boolean");
  }
  return expression(`${target.sql} IS NOT NULL`, "boolean");
}

function unixTime(args: Node[], host: FunctionHost): Operand {
  arity("unixTime", args, 1);
  requirePath("unixTime", args, 0);
  const target = host.target(args[0]);
  if (target.kind == "auth") {
    const time = new Date(target.value as string | number | Date).getTime();
    if (isNaN(time)) {
      throw new InvalidRuleError("unixTime needs a date.");
    }
    return constant(time / 1000);
  }
  if (target.kind != "column" || target.type != "timestamptz") {
    throw new UnsupportedRuleError("unixTime works on date fields only on PostgreSQL.");
  }
  return expression(`EXTRACT(EPOCH FROM ${target.sql})::double precision`, "double precision");
}

function now(args: Node[], host: FunctionHost): Operand {
  arity("now", args, 0);
  return constant((host.context.now?.() ?? Date.now()) / 1000);
}

function lengthOf(args: Node[], host: FunctionHost): Operand {
  arity("length", args, 1);
  if (Array.isArray(args[0])) {
    return constant(args[0].length);
  }
  requirePath("length", args, 0);
  const target = host.target(args[0]);

  if (target.kind == "auth") {
    const {value} = target;
    if (value === undefined || value === null) {
      return constant(0);
    }
    if (typeof value == "string" || Array.isArray(value)) {
      return constant(value.length);
    }
    throw new InvalidRuleError("length needs a list or a string.");
  }
  if (target.kind == "array") {
    return expression(`(SELECT COUNT(*) ${childRows(target, host.alias())})`, "bigint");
  }
  if (target.type == "text") {
    return expression(`char_length(${target.sql})`, "integer");
  }
  if (target.type == "jsonb") {
    return expression(
      `CASE WHEN jsonb_typeof(${target.sql}) = 'array' THEN jsonb_array_length(${target.sql}) END`,
      "integer"
    );
  }
  throw new UnsupportedRuleError("length works on lists and text only on PostgreSQL.");
}

const POSIX_INCOMPATIBLE: [RegExp, string][] = [
  [/\(\?<[=!]/, "lookbehind"],
  [/\(\?P?<[A-Za-z_]/, "named groups"],
  [/\(\?>/, "atomic groups"],
  [/\\[pP]/, "unicode properties"],
  [/\\[hHKGRX]/, "this escape"],
  [/\\Q/, "quoting with \\Q"]
];

function regex(args: Node[], host: FunctionHost): Operand {
  arity("regex", args, 2, 3);
  requirePath("regex", args, 0);
  const pattern = requireString("regex", args, 1);
  const flags = args.length == 3 ? requireString("regex", args, 2) : "";

  for (const [unsupported, name] of POSIX_INCOMPATIBLE) {
    if (unsupported.test(pattern)) {
      throw new UnsupportedRuleError(`PostgreSQL regular expressions do not support ${name}.`);
    }
  }
  if (flags.replace(/i/g, "")) {
    throw new UnsupportedRuleError(
      `The regex flag "${flags.replace(/i/g, "")}" is not supported on PostgreSQL. Only "i" is.`
    );
  }

  const target = host.target(args[0]);
  if (target.kind != "column" || (target.type != "text" && target.type != "uuid")) {
    throw new UnsupportedRuleError("regex works on text fields only on PostgreSQL.");
  }
  const input = target.type == "uuid" ? `${target.sql}::text` : target.sql;
  const operator = flags.includes("i") ? "~*" : "~";
  return {
    kind: "expression",
    sql: `${input} ${operator} ${host.param(pattern)}::text`,
    type: "boolean",
    twoValued: false
  };
}

function textMatch(name: "startsWith" | "contains"): Implementation {
  return (args, host) => {
    arity(name, args, 2);
    requirePath(name, args, 0);
    const text = requireString(name, args, 1);
    const target = host.target(args[0]);
    if (target.kind != "column" || (target.type != "text" && target.type != "uuid")) {
      throw new UnsupportedRuleError(`${name} works on text fields only on PostgreSQL.`);
    }
    if (target.property.type == "hash") {
      throw new UnsupportedRuleError(`${name} cannot be used on a hash field.`);
    }
    const escaped = text.replace(/[\\%_]/g, "\\$&");
    const pattern = name == "startsWith" ? `${escaped}%` : `%${escaped}%`;
    const input = target.type == "uuid" ? `${target.sql}::text` : target.sql;
    return {
      kind: "expression",
      sql: `${input} LIKE ${host.param(pattern)}::text`,
      type: "boolean",
      twoValued: false
    };
  };
}

function itemOf(node: Node, host: FunctionHost): Item {
  if (Array.isArray(node)) {
    return {value: node.map(child => itemOf(child, host).value), literal: false};
  }
  if (node.kind == "literal" && node.type != "bytes") {
    return {value: node.value, literal: true};
  }
  if (isPath(node)) {
    const target = host.target(node);
    if (target.kind == "auth") {
      return {value: target.value ?? null, literal: false};
    }
  }
  throw new UnsupportedRuleError(
    "A list in a rule can hold values written in the rule or taken from auth only on PostgreSQL."
  );
}

function itemsOf(node: Node, host: FunctionHost): Item[] {
  if (Array.isArray(node)) {
    return node.map(child => itemOf(child, host));
  }
  const target = host.target(node);
  if (target.kind != "auth") {
    throw new UnsupportedRuleError(
      "The second argument has to be a list written in the rule or taken from auth on PostgreSQL."
    );
  }
  if (target.value === undefined || target.value === null) {
    return [];
  }
  if (!Array.isArray(target.value)) {
    throw new InvalidRuleError("The second argument has to be a list.");
  }
  return target.value.map(value => ({value, literal: false}));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) == JSON.stringify(b);

function foldList(name: ListFunction, target: Item[], compare: Item[]): boolean {
  const contains = (list: Item[], item: Item) => list.some(other => same(other.value, item.value));
  switch (name) {
    case "some":
      return compare.some(item => contains(target, item));
    case "every":
      return compare.every(item => contains(target, item));
    case "equal":
      return target.length == compare.length && target.every(item => contains(compare, item));
  }
}

function elementValues(items: Item[], type: ColumnType): {values: unknown[]; dropped: number} {
  const values: unknown[] = [];
  let dropped = 0;
  for (const item of items) {
    if (type == "jsonb") {
      values.push(JSON.stringify(item.value));
      continue;
    }
    const coerced =
      item.value === null || Array.isArray(item.value)
        ? undefined
        : coerceConstant(constant(item.value as Scalar, item.literal), {type});
    const fits =
      coerced !== undefined &&
      (type != "integer" ||
        (Number.isInteger(coerced.value) &&
          (coerced.value as number) >= INT4.min &&
          (coerced.value as number) <= INT4.max));
    if (fits) {
      values.push(type == "bigint" ? String(coerced.value) : coerced.value);
    } else {
      dropped++;
    }
  }
  return {values, dropped};
}

type ListFunction = "some" | "every" | "equal";

function listFunction(name: ListFunction): Implementation {
  return (args, host) => {
    arity(name, args, 2);
    args.forEach((node, index) => {
      if (!isPath(node) && !Array.isArray(node)) {
        throw new InvalidRuleError(
          `Function '${name}' arg[${index}] must be property access chain or array.`
        );
      }
    });

    const compare = itemsOf(args[1], host);
    const target = Array.isArray(args[0]) ? itemsOf(args[0], host) : host.target(args[0]);

    if (Array.isArray(target)) {
      return constant(foldList(name, target, compare));
    }
    if (target.kind == "auth") {
      return constant(foldList(name, itemsOf(args[0], host), compare));
    }
    if (target.kind != "array") {
      throw new UnsupportedRuleError(`Function '${name}' needs a list field on PostgreSQL.`);
    }

    const {type} = target.element;
    const {values, dropped} = elementValues(compare, type);
    const alias = host.alias();
    const element = elementColumn(target, alias);
    const list = () => `${host.param(values, type)}::${type}[]`;

    switch (name) {
      case "some":
        return values.length
          ? expression(
              `EXISTS (SELECT 1 ${childRows(target, alias)} AND ${element} = ANY(${list()}))`,
              "boolean"
            )
          : constant(false);
      case "every":
        if (dropped) {
          return constant(false);
        }
        return values.length
          ? expression(
              `${list()} <@ ARRAY(SELECT ${element} ${childRows(target, alias)})`,
              "boolean"
            )
          : constant(true);
      case "equal":
        return expression(
          `(SELECT COUNT(*) = ${compare.length} AND COALESCE(BOOL_AND(${element} = ANY(${list()})), TRUE) ${childRows(target, alias)})`,
          "boolean"
        );
    }
  };
}

const FUNCTIONS: Record<string, Implementation> = {
  has,
  unixTime,
  now,
  length: lengthOf,
  regex,
  startsWith: textMatch("startsWith"),
  contains: textMatch("contains"),
  some: listFunction("some"),
  every: listFunction("every"),
  equal: listFunction("equal")
};

export function callFunction(name: string, args: Node[], host: FunctionHost): Operand {
  if (!Object.prototype.hasOwnProperty.call(FUNCTIONS, name)) {
    throw new InvalidRuleError(`Function '${name}' does not exist.`);
  }
  return FUNCTIONS[name](args, host);
}
