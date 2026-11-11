import {Bucket} from "@spica-server/interface-bucket";
import {parseRule} from "../access/rule/compiler.js";

type Scalar = string | number | boolean;
type Known = {known: true; value: Scalar};
type Value = Known | {known: false};
type Document = Record<string, unknown>;

const UNKNOWN: Value = {known: false};
const known = (value: Scalar): Known => ({known: true, value});

const COMPARABLE_TYPES = new Set(["string", "number", "boolean"]);

export type Prefilter = (document: Document) => boolean;

interface Environment {
  properties: Record<string, {type?: string; options?: {translate?: boolean}}>;
  auth: unknown;
  document: Document;
}

const isScalar = (value: unknown): value is Scalar =>
  typeof value == "string" || typeof value == "number" || typeof value == "boolean";

function fieldValue(name: string, environment: Environment): Value {
  const property = environment.properties[name];
  if (!property?.type || !COMPARABLE_TYPES.has(property.type) || property.options?.translate) {
    return UNKNOWN;
  }
  const value = environment.document[name];
  return typeof value == property.type ? known(value as Scalar) : UNKNOWN;
}

function authValue(path: string[], auth: unknown): Value {
  let value = auth;
  for (const key of path) {
    if (value === null || typeof value != "object" || !(key in value)) {
      return UNKNOWN;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return isScalar(value) ? known(value) : UNKNOWN;
}

function pathOf(node: any): {root: string; path: string[]} | undefined {
  const path: string[] = [];
  let current = node;
  while (current.kind == "operator" && current.type == "select") {
    if (current.right.kind != "identifier") {
      return undefined;
    }
    path.unshift(current.right.name);
    current = current.left;
  }
  return current.kind == "identifier" ? {root: current.name, path} : undefined;
}

function reference(node: any, environment: Environment): Value {
  const found = pathOf(node);
  if (!found) {
    return UNKNOWN;
  }
  if (found.root == "auth") {
    return found.path.length ? authValue(found.path, environment.auth) : UNKNOWN;
  }
  const path = found.root == "document" ? found.path : [found.root, ...found.path];
  return path.length == 1 ? fieldValue(path[0], environment) : UNKNOWN;
}

function both(operator: "and" | "or", left: Value, right: Value): Value {
  const [a, b] = [left, right].map(side =>
    side.known && typeof side.value == "boolean" ? side.value : undefined
  );
  if (operator == "and") {
    if (a === false || b === false) {
      return known(false);
    }
    return a === true && b === true ? known(true) : UNKNOWN;
  }
  if (a === true || b === true) {
    return known(true);
  }
  return a === false && b === false ? known(false) : UNKNOWN;
}

function compare(operator: string, left: Value, right: Value): Value {
  if (!left.known || !right.known || typeof left.value != typeof right.value) {
    return UNKNOWN;
  }
  if (operator == "==") {
    return known(left.value === right.value);
  }
  if (operator == "!=") {
    return known(left.value !== right.value);
  }
  if (typeof left.value != "number") {
    return UNKNOWN;
  }
  const [a, b] = [left.value, right.value as number];
  switch (operator) {
    case ">":
      return known(a > b);
    case ">=":
      return known(a >= b);
    case "<":
      return known(a < b);
    case "<=":
      return known(a <= b);
    default:
      return UNKNOWN;
  }
}

function membership(node: any, environment: Environment): Value {
  const left = evaluate(node.left, environment);
  if (!left.known || !Array.isArray(node.right)) {
    return UNKNOWN;
  }
  const items = node.right.map((item: any) => evaluate(item, environment));
  if (items.some((item: Value) => !item.known || typeof item.value != typeof left.value)) {
    return UNKNOWN;
  }
  return known(items.some((item: Known) => item.value === left.value));
}

function evaluate(node: any, environment: Environment): Value {
  switch (node.kind) {
    case "literal":
      return isScalar(node.value) ? known(node.value) : UNKNOWN;
    case "identifier":
      return reference(node, environment);
    case "unary": {
      const member = node.type == "not" ? evaluate(node.member, environment) : UNKNOWN;
      return member.known && typeof member.value == "boolean" ? known(!member.value) : UNKNOWN;
    }
    case "operator":
      return operation(node, environment);
    default:
      return UNKNOWN;
  }
}

function operation(node: any, environment: Environment): Value {
  if (node.category == "tenary") {
    const test = evaluate(node.test, environment);
    if (!test.known || typeof test.value != "boolean") {
      return UNKNOWN;
    }
    return evaluate(test.value ? node.consequent : node.alternative, environment);
  }
  switch (node.type) {
    case "select":
      return reference(node, environment);
    case "and":
    case "or":
      return both(node.type, evaluate(node.left, environment), evaluate(node.right, environment));
    case "in":
      return membership(node, environment);
    case "==":
    case "!=":
    case ">":
    case ">=":
    case "<":
    case "<=":
      return compare(
        node.type,
        evaluate(node.left, environment),
        evaluate(node.right, environment)
      );
    default:
      return UNKNOWN;
  }
}

function parsed(rule: string) {
  try {
    return parseRule(rule);
  } catch {
    return undefined;
  }
}

export function prefilterOf(
  bucket: Bucket,
  rules: string[],
  auth?: unknown
): Prefilter | undefined {
  const asts = rules.flatMap(rule => {
    const ast = parsed(rule);
    return ast ? [ast] : [];
  });
  if (!asts.length) {
    return undefined;
  }
  const properties = (bucket.properties ?? {}) as Environment["properties"];
  return document => {
    const environment = {properties, auth, document};
    return asts.some(ast => {
      const result = evaluate(ast, environment);
      return result.known && result.value === false;
    });
  };
}
