/**
 * The abstract syntax tree of Spica's expression language (a subset of CEL) — K-3's canonical input.
 *
 * This type lives in the driver contract, because **the compiler targets are inside the drivers**: the
 * Mongo driver compiles the same tree into a `$match`, the PostgreSQL driver into a `WHERE`. There is no
 * Mongo-to-SQL translation.
 *
 * Note: `packages/api/bucket/expression` currently returns untyped objects from the PEG parser
 * (`src/ast.ts` contains helper functions only). Phase 3's first job is to connect the parser's output to
 * the types here.
 */
export type Expression =
  | LiteralExpression
  | IdentifierExpression
  | SelectExpression
  | IndexExpression
  | UnaryExpression
  | BinaryExpression
  | ConditionalExpression
  | CallExpression
  | ListExpression;

export type LiteralKind = "string" | "double" | "int" | "uint" | "bool" | "null" | "bytes";

export interface LiteralExpression {
  kind: "literal";
  type: LiteralKind;
  value: string | number | boolean | null | Uint8Array;
}

export interface IdentifierExpression {
  kind: "identifier";
  name: string;
}

/** `a.b.c` — field access. */
export interface SelectExpression {
  kind: "select";
  left: Expression;
  right: IdentifierExpression;
}

/** `a[expr]` — array/map access. */
export interface IndexExpression {
  kind: "index";
  left: Expression;
  right: Expression;
}

export type UnaryOperator = "not" | "negative";

export interface UnaryExpression {
  kind: "unary";
  operator: UnaryOperator;
  operand: Expression;
}

/**
 * The closed operator set (K-4). Anything outside this list is rejected with
 * `UnsupportedExpressionError`; on user input, an HTTP 400.
 */
export type BinaryOperator =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "in"
  | "&&"
  | "||"
  | "+"
  | "-"
  | "*"
  | "/"
  | "%";

export interface BinaryExpression {
  kind: "binary";
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export interface ConditionalExpression {
  kind: "conditional";
  test: Expression;
  consequent: Expression;
  alternative: Expression;
}

/**
 * The registered builtin functions (K-4). The inventory was produced by measurement:
 * `docs/expression-surface.md`.
 */
export type BuiltinFunction =
  | "has"
  | "some"
  | "every"
  | "equal"
  | "regex"
  | "length"
  | "unixTime"
  | "now";

export interface CallExpression {
  kind: "call";
  callee: BuiltinFunction;
  arguments: Expression[];
}

export interface ListExpression {
  kind: "list";
  elements: Expression[];
}
