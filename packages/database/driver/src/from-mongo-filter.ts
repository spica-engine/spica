import {BinaryOperator, Expression} from "./expression.js";
import {UnsupportedExpressionError} from "./errors.js";

/**
 * A Mongo query filter (JSON) → the contract's `Expression` type.
 *
 * The bucket read surface accepts two filter languages, a CEL string and raw Mongo JSON. This bridge puts
 * the second one into the same plan, so relation stages, localization and SQL compilation all go through one
 * path instead of a shape-recognizing fallback.
 *
 * **Value conversion is not performed**: the caller already produced `ObjectId`/`Date` values from the
 * schema, and the compiler makes the final conversion from the column's declared type. `fromLegacyAst`
 * behaves the same way, or the two bridges would compile the same expression differently.
 */
export function fromMongoFilter(filter: Record<string, any>): Expression | undefined {
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
    throw unsupported(`'${typeof filter}' is not a filter document`);
  }

  const parts = Object.entries(filter).map(([key, value]) => entry(key, value));
  return conjoin(parts, "&&");
}

/**
 * A Mongo **aggregation** expression (`{$eq: ["$title", "x"]}`) → an `Expression`. The realtime path produces
 * exactly this, inside `$expr`, and does not go through `ReadPlan`, so there is no CEL to go back to.
 *
 * A field reference is `"$path"`, a constant a plain value. System variables such as `"$$ROOT"` raise.
 */
export function fromMongoAggExpression(expr: any): Expression {
  if (typeof expr === "string" && expr.startsWith("$")) {
    const path = expr.slice(1);
    if (!path || path.startsWith("$")) {
      throw unsupported(`aggregation variable '${expr}'`);
    }
    return documentPath(path);
  }

  if (expr === null || typeof expr !== "object" || expr instanceof Date) {
    return literal(expr);
  }

  if (Array.isArray(expr)) {
    return {kind: "list", elements: expr.map(fromMongoAggExpression)};
  }

  const keys = Object.keys(expr);

  /**
   * An operator **always** starts with `$`; anything else is a value — an `ObjectId` included, which is an
   * object whose only key is `buffer` and which every `_id` filter produces.
   */
  if (!keys.length || !keys[0].startsWith("$")) {
    return literal(expr);
  }

  if (keys.length !== 1) {
    throw unsupported(`aggregation expression with ${keys.length} operators`);
  }

  const [operator] = keys;
  const operand = expr[operator];

  if (operator === "$literal") {
    return literal(operand);
  }

  /**
   * `{$regexMatch: {input, regex, options}}` → the canonical `regex(...)` call, which the CEL compiler emits
   * in `match` mode. The CEL → Mongo → CEL round trip is the price of a downstream that wants a Mongo filter.
   */
  /**
   * `$size: <expr>` → the `length` builtin. The CEL converter emits it for `length(document.x)`.
   */
  if (operator === "$size") {
    return {kind: "call", callee: "length", arguments: [fromMongoAggExpression(operand)]};
  }

  /**
   * `$ifNull: [<expr>, []]` → just `<expr>`. The converter wraps array arguments so a missing field reads as
   * an empty array; the relational side needs no guard, because `= ANY(NULL)` is already false. Only the
   * empty-list default is unwrapped — any other one changes the meaning.
   */
  if (operator === "$ifNull") {
    const operands = asArray(operand, operator);
    const fallback = operands[1];
    if (!Array.isArray(fallback) || fallback.length) {
      throw unsupported("'$ifNull' with a default other than an empty list");
    }
    return fromMongoAggExpression(operands[0]);
  }

  /**
   * `{$and: [{$eq: [{$size: …}, n]}, {$eq: [{$setDifference: […]}, []]}]}` → `equal(...)`. The converter spells
   * `equal` as "the same length and nothing left over", and `$setDifference` has no counterpart of its own, so
   * the shape is recognized whole.
   */
  const arrayEquality = unwrapArrayEquality(operator, operand);
  if (arrayEquality) return arrayEquality;

  if (operator === "$regexMatch") {
    const {input, regex, options} = operand ?? {};
    if (input === undefined || regex === undefined) {
      throw unsupported("'$regexMatch' without input and regex");
    }
    const args = [fromMongoAggExpression(input), fromMongoAggExpression(regex)];
    if (options) args.push(fromMongoAggExpression(options));
    return {kind: "call", callee: "regex", arguments: args};
  }

  const binary = AGG_BINARY[operator];
  if (binary) {
    const operands = asArray(operand, operator);
    if (operands.length !== 2) {
      throw unsupported(`'${operator}' with ${operands.length} operands`);
    }

    /**
     * `{$eq: [<predicate>, true]}` is how a predicate is wrapped to sit in a `$match`. Compiled literally,
     * `regex(...) == true` would ask for the builtin in a **value** position, which it does not have.
     */
    const unwrapped = unwrapPredicate(operator, operands);
    if (unwrapped) return unwrapped;

    /**
     * `{$divide: [{$toLong: <expr>}, 1000]}` → `unixTime(<expr>)`. `$toLong` alone would need a builtin that
     * does not exist, so the pair is recognized together.
     */
    if (operator === "$divide" && operands[1] === 1000) {
      const inner = operands[0];
      if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
        const [innerOperator] = Object.keys(inner);
        if (innerOperator === "$toLong") {
          return {
            kind: "call",
            callee: "unixTime",
            arguments: [fromMongoAggExpression((inner as Record<string, any>).$toLong)]
          };
        }
      }
    }

    /**
     * `{$gt: [<path>, null]}` is how the converter spells `has(document.x)`, which MongoDB answers by BSON
     * type ordering. SQL has none: `"x" > NULL` is NULL, so the filter would silently return nothing.
     */
    if (operator === "$gt" && operands[1] === null) {
      return {kind: "call", callee: "has", arguments: [fromMongoAggExpression(operands[0])]};
    }

    return {
      kind: "binary",
      operator: binary,
      left: fromMongoAggExpression(operands[0]),
      right: fromMongoAggExpression(operands[1])
    };
  }

  if (operator === "$and" || operator === "$or") {
    const operands = asArray(operand, operator).map(fromMongoAggExpression);
    const combined = conjoin(operands, operator === "$and" ? "&&" : "||");
    if (!combined) throw unsupported(`'${operator}' with no operands`);
    return combined;
  }

  if (operator === "$not") {
    const operands = Array.isArray(operand) ? operand : [operand];
    return {kind: "unary", operator: "not", operand: fromMongoAggExpression(operands[0])};
  }

  if (operator === "$in") {
    const operands = asArray(operand, operator);
    return {
      kind: "binary",
      operator: "in",
      left: fromMongoAggExpression(operands[0]),
      right: fromMongoAggExpression(operands[1])
    };
  }

  throw unsupported(`aggregation operator '${operator}'`);
}

/**
 * Recognizes the `equal(target, values)` shape and rebuilds the builtin.
 *
 * Returns `undefined` when the shape does not match, so the caller falls through to the ordinary paths.
 */
function unwrapArrayEquality(operator: string, operand: any): Expression | undefined {
  if (operator !== "$and" || !Array.isArray(operand) || operand.length !== 2) return undefined;

  const difference = operand.find(
    clause =>
      clause?.$eq?.[0] !== null &&
      typeof clause?.$eq?.[0] === "object" &&
      "$setDifference" in clause.$eq[0]
  );
  if (!difference) return undefined;

  const [target, values] = difference.$eq[0].$setDifference;
  if (!Array.isArray(difference.$eq[1]) || difference.$eq[1].length) return undefined;

  return {
    kind: "call",
    callee: "equal",
    arguments: [fromMongoAggExpression(target), fromMongoAggExpression(values)]
  };
}

/**
 * The aggregation operators that already **are** a predicate, so `== true` around them is noise. `$in` is here
 * as well as in the binary table, because `some`/`every` are written as `{$eq: [{$in: […]}, true]}`.
 */
const AGG_PREDICATES = new Set(["$regexMatch", "$in"]);

function unwrapPredicate(operator: string, operands: any[]): Expression | undefined {
  if (operator !== "$eq" && operator !== "$ne") return undefined;

  const index = operands.findIndex(
    operand =>
      operand !== null &&
      typeof operand === "object" &&
      !Array.isArray(operand) &&
      AGG_PREDICATES.has(Object.keys(operand)[0])
  );
  if (index === -1) return undefined;

  const other = operands[1 - index];
  if (typeof other !== "boolean") return undefined;

  const predicate = fromMongoAggExpression(operands[index]);
  const negated = operator === "$ne" ? !other : other;
  return negated ? predicate : {kind: "unary", operator: "not", operand: predicate};
}

const AGG_BINARY: Record<string, BinaryOperator> = {
  $eq: "==",
  $ne: "!=",
  $gt: ">",
  $gte: ">=",
  $lt: "<",
  $lte: "<=",
  $add: "+",
  $subtract: "-",
  $multiply: "*",
  $divide: "/",
  $mod: "%"
};

/** A single `key: value` entry of the filter. */
function entry(key: string, value: any): Expression {
  switch (key) {
    case "$and":
    case "$or": {
      const parts = asArray(value, key).map(item => fromMongoFilter(item)!);
      const combined = conjoin(parts, key === "$and" ? "&&" : "||");
      if (!combined) throw unsupported(`'${key}' with no operands`);
      return combined;
    }

    case "$nor": {
      const parts = asArray(value, key).map(item => fromMongoFilter(item)!);
      const combined = conjoin(parts, "||");
      if (!combined) throw unsupported(`'$nor' with no operands`);
      return {kind: "unary", operator: "not", operand: combined};
    }

    case "$expr":
      return fromMongoAggExpression(value);

    case "$not":
      return {kind: "unary", operator: "not", operand: fromMongoFilter(value)!};

    default:
      if (key.startsWith("$")) {
        throw unsupported(`filter operator '${key}' at the top level`);
      }
      return field(key, value);
  }
}

/** `field: value` or `field: {$op: value}`. */
function field(path: string, value: any): Expression {
  const reference = documentPath(path);

  if (!isOperatorObject(value)) {
    return {kind: "binary", operator: "==", left: reference, right: literal(value)};
  }

  const parts = Object.entries(value).map(([operator, operand]) =>
    condition(reference, operator, operand)
  );
  const combined = conjoin(parts, "&&");
  if (!combined) throw unsupported(`'${path}' with an empty operator document`);
  return combined;
}

function condition(reference: Expression, operator: string, operand: any): Expression {
  switch (operator) {
    case "$eq":
      return {kind: "binary", operator: "==", left: reference, right: literal(operand)};
    case "$ne":
      return {kind: "binary", operator: "!=", left: reference, right: literal(operand)};
    case "$gt":
      return {kind: "binary", operator: ">", left: reference, right: literal(operand)};
    case "$gte":
      return {kind: "binary", operator: ">=", left: reference, right: literal(operand)};
    case "$lt":
      return {kind: "binary", operator: "<", left: reference, right: literal(operand)};
    case "$lte":
      return {kind: "binary", operator: "<=", left: reference, right: literal(operand)};

    case "$in":
      return {
        kind: "binary",
        operator: "in",
        left: reference,
        right: {kind: "list", elements: asArray(operand, operator).map(literal)}
      };

    /**
     * `$nin` **matches a missing field too**, as in Mongo: a plain `!(x in …)` yields NULL on a NULL column and
     * drops the row. `crud-filter-to-sql` makes the same decision.
     */
    case "$nin":
      return {
        kind: "binary",
        operator: "||",
        left: {
          kind: "unary",
          operator: "not",
          operand: {
            kind: "binary",
            operator: "in",
            left: reference,
            right: {kind: "list", elements: asArray(operand, operator).map(literal)}
          }
        },
        right: {kind: "binary", operator: "==", left: reference, right: literal(null)}
      };

    /**
     * `$regex` is the `regex()` builtin, not an operator. `$options` arrives as a separate key and is skipped:
     * it is not a condition on its own, and `regex()` takes no second argument.
     */
    case "$regex":
      return {
        kind: "call",
        callee: "regex",
        arguments: [reference, literal(operand instanceof RegExp ? operand.source : operand)]
      };

    case "$options":
      return {kind: "literal", type: "bool", value: true};

    /**
     * `$exists` means "not NULL" on a column. `{a: null}` and `{}` differ in a document store and cannot be
     * told apart here — the same limit `codec.toDocument` declares.
     */
    case "$exists":
      return operand
        ? {kind: "binary", operator: "!=", left: reference, right: literal(null)}
        : {kind: "binary", operator: "==", left: reference, right: literal(null)};

    case "$not":
      return {
        kind: "unary",
        operator: "not",
        operand: isOperatorObject(operand)
          ? conjoin(
              Object.entries(operand).map(([inner, value]) => condition(reference, inner, value)),
              "&&"
            )!
          : {kind: "binary", operator: "==", left: reference, right: literal(operand)}
      };

    default:
      throw unsupported(`filter operator '${operator}'`);
  }
}

/** `a.b.c` → the `document.a.b.c` selection chain. */
function documentPath(path: string): Expression {
  return path
    .split(".")
    .reduce<Expression>(
      (left, segment) => ({kind: "select", left, right: {kind: "identifier", name: segment}}),
      {
        kind: "identifier",
        name: "document"
      }
    );
}

/**
 * A value → a literal node. `type` is only a hint: `ObjectId` and `Date` are marked `"string"` and the real
 * conversion happens in the compiler, from the column's declared type — as in `fromLegacyAst`.
 */
function literal(value: any): Expression {
  if (value === null || value === undefined) {
    return {kind: "literal", type: "null", value: null};
  }
  if (typeof value === "boolean") {
    return {kind: "literal", type: "bool", value};
  }
  if (typeof value === "number") {
    return {kind: "literal", type: Number.isInteger(value) ? "int" : "double", value};
  }
  return {kind: "literal", type: "string", value};
}

function conjoin(parts: Expression[], operator: "&&" | "||"): Expression | undefined {
  const present = parts.filter(Boolean);
  if (!present.length) return undefined;
  return present.reduce((left, right) => ({kind: "binary", operator, left, right}));
}

/**
 * An operator document, or the value itself? `{$gt: 5}` against `{name: "x"}`. The distinction is whether the
 * **first key** starts with `$`, which is Mongo's own rule; a mixed document is invalid there too.
 */
function isOperatorObject(value: any): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Date) {
    return false;
  }
  // Wrappers such as `ObjectId` are objects but not operator documents.
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every(key => key.startsWith("$"));
}

function asArray(value: any, operator: string): any[] {
  if (!Array.isArray(value)) throw unsupported(`'${operator}' expects an array`);
  return value;
}

function unsupported(message: string): UnsupportedExpressionError {
  return new UnsupportedExpressionError(message, "postgres");
}
