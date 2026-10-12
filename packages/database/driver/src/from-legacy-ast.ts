import {BinaryOperator, BuiltinFunction, Expression, LiteralKind} from "./expression.js";
import {UnsupportedExpressionError} from "./errors.js";

/**
 * The PEG parser's output → the contract's `Expression` type.
 *
 * **"One language, N compilers" is not real without this adapter.** The `packages/api/bucket/expression`
 * grammar returns untyped objects (`src/ast.ts` contains helper functions only, no interface), and
 * `convert.ts` and `compile.ts` were written against that shape. The contract, on the other hand, defines
 * a typed tree.
 *
 * This function joins the two: the parser's current output is turned into the typed tree unchanged, so
 * that **the same expression** can be given both to the Mongo target (`convert.ts`) and to the PG target
 * (`expression-to-sql.ts`). That is the precondition of the differential test (Phase 3d).
 *
 * In the long run the parser should produce these types directly; then this adapter is deleted.
 *
 * **Why it is in the driver package.** It started out next to the PostgreSQL compilers, but the side that
 * produces the `ReadPlan` (the bucket read path) needs the same bridge and that side lives in `api`.
 * Importing it from the PG package would carry that package into Mongo installations too — and it is
 * loaded **lazily** on purpose. The bridge already produces the contract's canonical input, so this is
 * where it belongs.
 */
export function fromLegacyAst(node: any): Expression {
  if (!node || typeof node !== "object") {
    throw unsupported(`'${typeof node}' is not a parser node`);
  }

  /**
   * The grammar returns array literals (`["a","b"]`) as a plain JS array with NO `kind` field
   * (`grammar.pegjs`: `Atomic = "[" exprList "]" { return exprList }`). A detail that cannot be guessed
   * from the typed contract; it surfaced while testing against the real parser output.
   */
  if (Array.isArray(node)) return fromLegacyList(node);

  switch (node.kind) {
    case "literal":
      return {
        kind: "literal",
        type: legacyLiteralType(node.type),
        value: node.value
      };

    case "identifier":
      return {kind: "identifier", name: node.name};

    case "unary":
      if (node.type === "not") {
        return {kind: "unary", operator: "not", operand: fromLegacyAst(node.member)};
      }
      if (node.type === "negative") {
        return {kind: "unary", operator: "negative", operand: fromLegacyAst(node.member)};
      }
      throw unsupported(`unary '${node.type}'`);

    case "call":
      // In the grammar a call hangs off the left side as a `MemberOperation`: `{kind:"call", left, arguments}`
      return {
        kind: "call",
        callee: legacyCallee(node),
        arguments: (node.arguments || []).map(fromLegacyAst)
      };

    case "operator":
      return fromLegacyOperator(node);

    default:
      throw unsupported(`parser node kind '${node.kind}'`);
  }
}

function fromLegacyOperator(node: any): Expression {
  if (node.category === "tenary" && node.type === "conditional") {
    return {
      kind: "conditional",
      test: fromLegacyAst(node.test),
      consequent: fromLegacyAst(node.consequent),
      alternative: fromLegacyAst(node.alternative)
    };
  }

  if (node.category !== "binary") {
    throw unsupported(`operator category '${node.category}'`);
  }

  if (node.type === "select") {
    const right = fromLegacyAst(node.right);
    if (right.kind !== "identifier") {
      throw unsupported("property access with a non-identifier on the right");
    }
    return {kind: "select", left: fromLegacyAst(node.left), right};
  }

  if (node.type === "index") {
    return {kind: "index", left: fromLegacyAst(node.left), right: fromLegacyAst(node.right)};
  }

  const operator = legacyBinaryOperator(node.type);
  return {
    kind: "binary",
    operator,
    left: fromLegacyAst(node.left),
    right: fromLegacyAst(node.right)
  };
}

/** The grammar returns array/map literals as a plain array. */
export function fromLegacyList(nodes: any[]): Expression {
  return {kind: "list", elements: nodes.map(fromLegacyAst)};
}

const BINARY: Record<string, BinaryOperator> = {
  "==": "==",
  "!=": "!=",
  "<": "<",
  "<=": "<=",
  ">": ">",
  ">=": ">=",
  in: "in",
  and: "&&",
  or: "||",
  "+": "+",
  "-": "-",
  "*": "*",
  "/": "/",
  "%": "%"
};

function legacyBinaryOperator(type: string): BinaryOperator {
  const operator = BINARY[type];
  if (!operator) throw unsupported(`binary operator '${type}'`);
  return operator;
}

const LITERAL: Record<string, LiteralKind> = {
  string: "string",
  double: "double",
  int: "int",
  uint: "uint",
  bool: "bool",
  null: "null",
  bytes: "bytes"
};

function legacyLiteralType(type: string): LiteralKind {
  const kind = LITERAL[type];
  if (!kind) throw unsupported(`literal type '${type}'`);
  return kind;
}

/** The measured builtin set: `docs/expression-surface.md`. */
const BUILTINS: BuiltinFunction[] = [
  "has",
  "some",
  "every",
  "equal",
  "regex",
  "length",
  "unixTime",
  "now"
];

function legacyCallee(node: any): BuiltinFunction {
  // `func.visit(node.left.name, …)` — the name of the called function is on the left node.
  const name = node.left?.name ?? node.callee;
  if (!BUILTINS.includes(name)) throw unsupported(`builtin '${name}'`);
  return name;
}

function unsupported(detail: string): UnsupportedExpressionError {
  return new UnsupportedExpressionError(detail, "postgres");
}
