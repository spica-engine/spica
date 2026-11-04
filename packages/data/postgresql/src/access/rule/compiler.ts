import {parser} from "@spica-server/bucket-expression/src/parser";
import {bind, InlineValues, literalOf} from "@spica-server/data-postgresql-orm";
import {ColumnType} from "../../schema/metadata/types.js";
import {coerceConstant} from "./coerce.js";
import {InvalidRuleError, UnsupportedRuleError} from "./errors.js";
import {Joins, locate, resolveField, RuleScope} from "./fields.js";
import {callFunction, FunctionHost} from "./functions.js";
import {Column, constant, Constant, Expression, isNull, Operand, Scalar} from "./operands.js";

type Node = any;

type ComparisonOperator = "==" | "!=" | ">" | ">=" | "<" | "<=";
type ArithmeticOperator = "+" | "-" | "*" | "/" | "%";

const COMPARISONS = new Set<string>(["==", "!=", ">", ">=", "<", "<="]);
const ARITHMETIC = new Set<string>(["+", "-", "*", "/", "%"]);

const NUMBER_TYPES = new Set<ColumnType>(["integer", "bigint", "double precision"]);

const expression = (sql: string, type: ColumnType, twoValued: boolean): Expression => ({
  kind: "expression",
  sql,
  type,
  twoValued
});

const booleanSql = (value: unknown) => (value ? "TRUE" : "FALSE");

function typeClass(type: ColumnType): string {
  if (type == "jsonb" || type == "point") {
    throw new UnsupportedRuleError(`A ${type} field cannot be compared in a rule.`);
  }
  return NUMBER_TYPES.has(type) ? "number" : type;
}

function equal(a: Scalar, b: Scalar) {
  return a instanceof Date && b instanceof Date ? a.getTime() == b.getTime() : a === b;
}

function foldComparison(operator: ComparisonOperator, a: Scalar, b: Scalar): boolean {
  if (operator == "==") {
    return equal(a, b);
  }
  if (operator == "!=") {
    return !equal(a, b);
  }
  const sameKind =
    (typeof a == "number" && typeof b == "number") ||
    (typeof a == "string" && typeof b == "string") ||
    (a instanceof Date && b instanceof Date);
  if (!sameKind) {
    throw new UnsupportedRuleError(`A rule cannot order ${typeof a} against ${typeof b}.`);
  }
  const [x, y] = [a.valueOf() as number, b.valueOf() as number];
  return operator == ">" ? x > y : operator == ">=" ? x >= y : operator == "<" ? x < y : x <= y;
}

function foldArithmetic(operator: ArithmeticOperator, a: Scalar, b: Scalar): number {
  if (typeof a != "number" || typeof b != "number") {
    throw new UnsupportedRuleError(`"${operator}" works on numbers only in a rule.`);
  }
  if ((operator == "/" || operator == "%") && b == 0) {
    throw new InvalidRuleError("A rule cannot divide by zero.");
  }
  switch (operator) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return a / b;
    case "%":
      return a % b;
  }
}

// NUL cannot occur in an identifier or in any text the compiler writes, so a placeholder is never
// mistaken for text.
const MARK = "\u0000";

interface Pending {
  value: unknown;
  listOf?: ColumnType;
}

class RuleCompiler {
  private readonly pending: Pending[] = [];
  private readonly joins = new Joins();
  private aliases = 0;

  constructor(private readonly scope: RuleScope) {}

  // Folding can drop a subtree after it has bound its values, so placeholders are numbered only once
  // the final SQL is known.
  private param(value: unknown, listOf?: ColumnType) {
    return `${MARK}${this.pending.push({value, listOf}) - 1}${MARK}`;
  }

  private bound(id: number, values: unknown[]) {
    const {value, listOf} = this.pending[id];
    return listOf && values instanceof InlineValues
      ? `ARRAY[${(value as unknown[]).map(item => literalOf(item)).join(", ")}]`
      : bind(values, value);
  }

  finish(operand: Operand, values: unknown[]): CompiledRule {
    const truth = this.truth(operand);
    const sql = this.truthSql(truth)
      .split(MARK)
      .map((part, index) => (index % 2 ? this.bound(Number(part), values) : part))
      .join("");
    return {
      sql,
      joins: this.joins.usedBy(sql),
      ...(truth.kind == "constant" ? {constant: Boolean(truth.value)} : {})
    };
  }

  private host(): FunctionHost {
    return {
      scope: this.scope,
      param: (value, listOf) => this.param(value, listOf),
      alias: () => `_a${++this.aliases}`,
      target: node => this.target(node)
    };
  }

  private target(node: Node) {
    const {root, path} = this.pathOf(node);
    if (root == "auth") {
      return {kind: "auth" as const, value: this.authValue(path)};
    }
    return locate(root == "document" ? path : [root, ...path], this.scope, this.joins);
  }

  visit(node: Node): Operand {
    if (Array.isArray(node)) {
      throw new UnsupportedRuleError("A list cannot be used in a rule on PostgreSQL yet.");
    }
    switch (node.kind) {
      case "literal":
        return this.literal(node);
      case "identifier":
        return this.path(node.name, []);
      case "operator":
        return node.category == "tenary" ? this.conditional(node) : this.binary(node);
      case "unary":
        return this.unary(node);
      case "call":
        return callFunction(node.left.name, node.arguments, this.host());
      default:
        throw new InvalidRuleError(`Unknown expression "${node.kind}".`);
    }
  }

  private literal(node: Node): Constant {
    if (node.type == "bytes") {
      throw new UnsupportedRuleError("Bytes cannot be used in a rule on PostgreSQL.");
    }
    if (node.type == "double" && typeof node.value != "number") {
      throw new UnsupportedRuleError(
        "A decimal number is not read correctly by the rule parser yet. Compute it from whole numbers instead."
      );
    }
    return constant(node.value, true);
  }

  private binary(node: Node): Operand {
    const type: string = node.type;
    if (type == "and" || type == "or") {
      return this.logical(type, this.visit(node.left), this.visit(node.right));
    }
    if (COMPARISONS.has(type)) {
      return this.compare(
        type as ComparisonOperator,
        this.visit(node.left),
        this.visit(node.right)
      );
    }
    if (ARITHMETIC.has(type)) {
      return this.arithmetic(
        type as ArithmeticOperator,
        this.visit(node.left),
        this.visit(node.right)
      );
    }
    if (type == "select") {
      return this.select(node);
    }
    throw new UnsupportedRuleError(`The operator "${type}" is not supported on PostgreSQL.`);
  }

  private pathOf(node: Node): {root: string; path: string[]} {
    const path: string[] = [];
    let current = node;
    while (current.kind == "operator" && current.type == "select") {
      if (current.right.kind != "identifier") {
        throw new UnsupportedRuleError("Only property names can follow a dot in a rule.");
      }
      path.unshift(current.right.name);
      current = current.left;
    }
    if (current.kind != "identifier") {
      throw new InvalidRuleError("A property path has to start with a name.");
    }
    return {root: current.name, path};
  }

  private select(node: Node): Operand {
    const {root, path} = this.pathOf(node);
    return this.path(root, path);
  }

  private path(root: string, rest: string[]): Operand {
    if (root == "auth") {
      return this.auth(rest);
    }
    if (root == "document") {
      if (!rest.length) {
        throw new InvalidRuleError('"document" has to be followed by a property.');
      }
      return resolveField(rest, this.scope, this.joins);
    }
    return resolveField([root, ...rest], this.scope, this.joins);
  }

  private authValue(path: string[]): unknown {
    if (!path.length) {
      throw new InvalidRuleError('"auth" has to be followed by a property.');
    }
    return path.reduce<unknown>(
      (source, key) =>
        source !== null && typeof source == "object" && key in source
          ? (source as Record<string, unknown>)[key]
          : undefined,
      this.scope.auth
    );
  }

  private auth(path: string[]): Constant {
    const value = this.authValue(path);
    if (value === undefined || value === null) {
      return constant(null);
    }
    if (typeof value == "bigint") {
      return constant(value.toString());
    }
    if (
      typeof value == "string" ||
      typeof value == "number" ||
      typeof value == "boolean" ||
      value instanceof Date
    ) {
      return constant(value);
    }
    throw new UnsupportedRuleError(`"auth.${path.join(".")}" is not a single value.`);
  }

  private unary(node: Node): Operand {
    if (node.type != "not") {
      throw new UnsupportedRuleError("Negative numbers are not supported in a rule.");
    }
    if (node.member.type == "select" || node.member.type == "identifier") {
      throw new InvalidRuleError(
        `unary operator 'not' does not support "${node.member.type}".\nDid you mean to wrap your expression with brackets?\n!document.title=="test" -> !(document.title=="test")`
      );
    }
    const member = this.truth(this.visit(node.member));
    if (member.kind == "constant") {
      return constant(!member.value);
    }
    const inner = member.twoValued ? member.sql : `COALESCE(${member.sql}, FALSE)`;
    return expression(`NOT (${inner})`, "boolean", true);
  }

  private conditional(node: Node): Operand {
    const test = this.truth(this.visit(node.test));
    const consequent = this.truth(this.visit(node.consequent));
    const alternative = this.truth(this.visit(node.alternative));
    if (test.kind == "constant") {
      return test.value ? consequent : alternative;
    }
    const sql = `CASE WHEN ${test.sql} THEN ${this.truthSql(consequent)} ELSE ${this.truthSql(alternative)} END`;
    return expression(
      sql,
      "boolean",
      this.isTwoValued(consequent) && this.isTwoValued(alternative)
    );
  }

  private isTwoValued(operand: Constant | Expression) {
    return operand.kind == "constant" || operand.twoValued;
  }

  private truth(operand: Operand): Constant | Expression {
    if (operand.kind == "constant") {
      if (operand.value === null) {
        return constant(false);
      }
      if (typeof operand.value != "boolean") {
        throw new InvalidRuleError("A rule needs a true or false value here.");
      }
      return operand;
    }
    if (operand.type != "boolean") {
      throw new InvalidRuleError("A rule needs a true or false value here.");
    }
    return operand.kind == "column"
      ? expression(`${operand.sql} IS TRUE`, "boolean", true)
      : operand;
  }

  private truthSql(operand: Constant | Expression) {
    return operand.kind == "constant" ? booleanSql(operand.value) : operand.sql;
  }

  private logical(kind: "and" | "or", left: Operand, right: Operand): Operand {
    const a = this.truth(left);
    const b = this.truth(right);
    const absorbing = kind == "or";
    for (const [side, other] of [
      [a, b],
      [b, a]
    ] as const) {
      if (side.kind == "constant") {
        return side.value == absorbing ? side : other;
      }
    }
    const keyword = kind == "and" ? "AND" : "OR";
    return expression(
      `(${this.truthSql(a)} ${keyword} ${this.truthSql(b)})`,
      "boolean",
      this.isTwoValued(a) && this.isTwoValued(b)
    );
  }

  private compare(operator: ComparisonOperator, left: Operand, right: Operand): Operand {
    if (left.kind == "constant" && right.kind == "constant") {
      return constant(foldComparison(operator, left.value, right.value));
    }
    const equality = operator == "==" || operator == "!=";

    if (isNull(left) || isNull(right)) {
      if (!equality) {
        throw new UnsupportedRuleError("A rule cannot order a value against null.");
      }
      const other = isNull(left) ? right : left;
      return expression(
        `${(other as Column | Expression).sql} IS ${operator == "==" ? "" : "NOT "}NULL`,
        "boolean",
        true
      );
    }

    if (left.kind == "constant" || right.kind == "constant") {
      return this.compareWithConstant(operator, left, right);
    }
    return this.compareOperands(operator, left, right);
  }

  private compareWithConstant(operator: ComparisonOperator, left: Operand, right: Operand) {
    const typed = (left.kind == "constant" ? right : left) as Column | Expression;
    const value = (left.kind == "constant" ? left : right) as Constant;
    const coerced = coerceConstant(
      value,
      {type: typed.type, property: typed.kind == "column" ? typed.property : undefined},
      this.scope.hashSecret
    );

    if (!coerced) {
      if (operator == "==" || operator == "!=") {
        return constant(operator == "!=");
      }
      throw new UnsupportedRuleError(
        `A rule cannot order a ${typed.type} value against a ${typeof value.value}.`
      );
    }

    const parameter = `${this.param(coerced.value)}::${coerced.cast}`;
    const [a, b] = left.kind == "constant" ? [parameter, typed.sql] : [typed.sql, parameter];
    return this.comparison(operator, a, b, false);
  }

  private compareOperands(operator: ComparisonOperator, left: Operand, right: Operand) {
    const [a, b] = [left, right] as (Column | Expression)[];
    const [classA, classB] = [typeClass(a.type), typeClass(b.type)];

    if (classA == classB) {
      return this.comparison(operator, a.sql, b.sql, true);
    }
    if ((classA == "uuid" && classB == "text") || (classA == "text" && classB == "uuid")) {
      return this.comparison(operator, `${a.sql}::text`, `${b.sql}::text`, true);
    }
    if (operator == "==" || operator == "!=") {
      return constant(operator == "!=");
    }
    throw new UnsupportedRuleError(`A rule cannot order a ${a.type} value against a ${b.type}.`);
  }

  private comparison(operator: ComparisonOperator, a: string, b: string, bothSides: boolean) {
    switch (operator) {
      case "==":
        return expression(
          bothSides ? `${a} IS NOT DISTINCT FROM ${b}` : `${a} = ${b}`,
          "boolean",
          bothSides
        );
      case "!=":
        return expression(`${a} IS DISTINCT FROM ${b}`, "boolean", true);
      default:
        return expression(`${a} ${operator} ${b}`, "boolean", false);
    }
  }

  private arithmetic(operator: ArithmeticOperator, left: Operand, right: Operand): Operand {
    if (left.kind == "constant" && right.kind == "constant") {
      return constant(foldArithmetic(operator, left.value, right.value));
    }

    const integral = [left, right].every(operand => this.isIntegral(operand));
    const cast: ColumnType = integral && operator != "/" ? "bigint" : "double precision";
    const [a, b] = [left, right].map(operand => this.numeric(operand, cast, operator));

    if (operator == "/" || operator == "%") {
      // A zero divisor turns the row's result into NULL instead of failing the whole query.
      const divisor = `NULLIF(${b}, 0)`;
      if (operator == "/") {
        return expression(`(${a} / ${divisor})`, cast, false);
      }
      return cast == "bigint"
        ? expression(`(${a} % ${divisor})`, cast, false)
        : expression(`mod(${a}::numeric, ${divisor}::numeric)::double precision`, cast, false);
    }
    return expression(`(${a} ${operator} ${b})`, cast, false);
  }

  private isIntegral(operand: Operand) {
    if (operand.kind == "constant") {
      return typeof operand.value == "number" && Number.isSafeInteger(operand.value);
    }
    return operand.type == "integer" || operand.type == "bigint";
  }

  private numeric(operand: Operand, cast: ColumnType, operator: ArithmeticOperator): string {
    if (operand.kind == "constant") {
      if (typeof operand.value != "number") {
        throw new UnsupportedRuleError(`"${operator}" works on numbers only in a rule.`);
      }
      return `${this.param(operand.value)}::${cast}`;
    }
    if (!NUMBER_TYPES.has(operand.type)) {
      throw new UnsupportedRuleError(`"${operator}" works on numbers only in a rule.`);
    }
    return `${operand.sql}::${cast}`;
  }
}

function parse(rule: string): Node {
  try {
    return parser.parse(rule);
  } catch (error) {
    throw new InvalidRuleError((error as Error).message);
  }
}

export interface CompiledRule {
  sql: string;
  joins: string[];
  constant?: boolean;
}

export function compileRule(rule: string, scope: RuleScope, values: unknown[]): CompiledRule {
  const compiler = new RuleCompiler(scope);
  return compiler.finish(compiler.visit(parse(rule)), values);
}
