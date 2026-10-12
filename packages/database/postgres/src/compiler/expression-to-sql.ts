import {
  Expression,
  UnsupportedExpressionError,
  ColumnKind,
  TableSpec
} from "@spica-server/database-driver";
import {hexIfObjectId} from "../schema/codec.js";

/**
 * A CEL expression → a parameterized `WHERE`, from the **same AST** `convert.ts` compiles for Mongo; there is
 * no Mongo-to-SQL translation.
 *
 * A closed set: a node not on the list is rejected. Producing the wrong SQL silently means returning the
 * wrong rows silently.
 */
export interface SqlFragment {
  sql: string;
  params: unknown[];
}

export interface CompileContext {
  /** To know the column types; translatable fields need a `COALESCE`. */
  table: TableSpec;
  /** Which language translatable fields resolve to. */
  locale?: {best: string; fallback: string};
  /** The table alias (as in `p.title`). */
  alias?: string;
  /** An `auth.*` chain is resolved at compile time: it belongs to the requesting identity, not to the row. */
  auth?: Record<string, any>;
  /** Where parameter numbering starts; used when several fragments are combined. */
  paramOffset?: number;
  /**
   * The relations joined **before** the filter: path → {join alias, the target's table definition}. A filter
   * can reference a relation's field, which is not on this table but inside the join's `to_jsonb(target)`.
   *
   * The target's definition is carried because `->>` returns **text** and jsonb writes a `timestamptz` as
   * `+00:00` while the client sends `.000Z`: a text comparison would silently find nothing.
   */
  relations?: Record<string, RelationInfo>;
}

export function compileExpression(expression: Expression, context: CompileContext): SqlFragment {
  const state = new CompilerState(context);
  const sql = state.visitPredicate(expression);
  return {sql, params: state.params};
}

class CompilerState {
  readonly params: unknown[] = [];
  private columns = new Map<string, ColumnKind>();
  private translated = new Set<string>();

  constructor(private context: CompileContext) {
    for (const column of context.table.columns) {
      this.columns.set(column.name, column.kind);
      if (column.translated) this.translated.add(column.name);
    }
  }

  // ── Predicate nodes (the ones that produce a boolean)
  visitPredicate(node: Expression): string {
    switch (node.kind) {
      case "binary":
        return this.visitBinaryPredicate(node);
      case "unary":
        if (node.operator === "not") return `NOT (${this.visitPredicate(node.operand)})`;
        throw unsupported(`unary '${node.operator}' as a predicate`);
      case "call":
        return this.visitCallPredicate(node);
      case "literal":
        // Constant predicates such as `true==true` arrive as the ACL default.
        if (node.type === "bool") return node.value ? "TRUE" : "FALSE";
        throw unsupported(`literal of type '${node.type}' as a predicate`);
      case "conditional":
        // `a ? b : c` as a predicate: (a AND b) OR (NOT a AND c) — the same expansion as convert.ts.
        return (
          `((${this.visitPredicate(node.test)} AND ${this.visitPredicate(node.consequent)})` +
          ` OR (NOT (${this.visitPredicate(node.test)}) AND ${this.visitPredicate(node.alternative)}))`
        );
      default:
        throw unsupported(`'${node.kind}' as a predicate`);
    }
  }

  private visitBinaryPredicate(node: Extract<Expression, {kind: "binary"}>): string {
    switch (node.operator) {
      case "&&":
        return `(${this.visitPredicate(node.left)} AND ${this.visitPredicate(node.right)})`;
      case "||":
        return `(${this.visitPredicate(node.left)} OR ${this.visitPredicate(node.right)})`;
      case "==":
      case "!=":
      case "<":
      case "<=":
      case ">":
      case ">=":
        return this.comparison(node.operator, node.left, node.right);
      case "in":
        return this.membership(node.left, node.right);
      default:
        throw unsupported(`binary operator '${node.operator}' as a predicate`);
    }
  }

  private comparison(operator: string, left: Expression, right: Expression): string {
    /**
     * A comparison against a `many` relation's field means **"any element"**, which is what Mongo's `$match`
     * gives on an array field. A resolved `many` relation is a jsonb array, and `->>'name'` on an array is
     * `NULL`, so the row would silently drop out.
     *
     * `EXISTS` rather than a join, because a join repeats the base row per element and breaks pagination and
     * `count`.
     */
    const many = this.manyRelationField(left) || this.manyRelationField(right);
    if (many) {
      return this.existsOverMany(many, operator, left, right);
    }

    const l = this.visitValue(left);
    const r = this.visitValue(right);

    // A comparison against NULL does not work with `=` in SQL.
    if (operator === "==" && r === "NULL") return `${l} IS NULL`;
    if (operator === "!=" && r === "NULL") return `${l} IS NOT NULL`;
    if (operator === "==" && l === "NULL") return `${r} IS NULL`;
    if (operator === "!=" && l === "NULL") return `${r} IS NOT NULL`;

    /**
     * `!=` is **NULL-safe**: `<>` yields NULL on a NULL column and the row drops out, while Mongo's `$ne`
     * matches a missing field. `==` needs none of this, because a NULL right-hand side became `IS NULL`.
     */
    if (operator === "!=") return `(${l} IS DISTINCT FROM ${r})`;

    const sqlOperator = operator === "==" ? "=" : operator;
    return `(${l} ${sqlOperator} ${r})`;
  }

  /**
   * `x in [a, b]` and `x in document.tags`. On an array column Mongo's `$in` is **intersection** (`&&`), not
   * containment (`@>`) — `crud-filter-to-sql` draws the same distinction and the two have to agree.
   */
  private membership(left: Expression, right: Expression): string {
    const rightKind = this.columnKindOf(right);
    if (rightKind === "textArray" || rightKind === "numberArray") {
      return `(${this.visitValue(left)} = ANY(${this.visitValue(right)}))`;
    }

    if (right.kind !== "list") {
      throw unsupported("'in' with a right side that is neither a list nor an array column");
    }

    const leftKind = this.columnKindOf(left);
    const reference = this.visitValue(left);

    if (!right.elements.length) return "FALSE";

    const elements = right.elements.map(element => this.visitValue(element));

    if (leftKind === "textArray" || leftKind === "numberArray") {
      return `(${reference} && ARRAY[${elements.join(", ")}])`;
    }

    return `(${reference} IN (${elements.join(", ")}))`;
  }

  /** Does a node look directly at a column? If so, of what kind. */
  private columnKindOf(node: Expression): ColumnKind | undefined {
    if (node.kind === "identifier") return this.columns.get(node.name);
    if (node.kind !== "select") return undefined;
    const path = flattenSelect(node);
    if (path[0] !== "document" || path.length !== 2) return undefined;
    return this.columns.get(path[1]);
  }

  // ── Value nodes (the ones that produce a scalar)
  visitValue(node: Expression): string {
    switch (node.kind) {
      case "literal":
        return this.bind(node.value);
      case "identifier":
        /**
         * A bare identifier is a **document field**: `name == "x"` ≡ `document.name == "x"`, which is what
         * the Mongo target does too.
         */
        return this.documentField(node.name, []);
      case "select":
        return this.visitSelect(node);
      case "binary":
        return this.arithmetic(node);
      case "call":
        return this.visitCallValue(node);
      default:
        throw unsupported(`'${node.kind}' as a value`);
    }
  }

  /**
   * Does the node look at a sub-field of a `many` relation? The chain is **walked**, not just its first
   * level: in `document.user.wallet.name` the array is the second level, and `->>` on an array is `NULL`.
   *
   * A child has no alias — its join lives inside the parent's lateral — so it is reached through the
   * parent's assembled jsonb.
   */
  private manyRelationField(
    node: Expression
  ): {array: string; table: TableSpec; nested: string[]} | undefined {
    if (node.kind !== "select") return undefined;
    const chain = flattenSelect(node);
    const rest = chain[0] === "document" ? chain.slice(1) : chain;

    let info = this.context.relations?.[rest[0]];
    if (!info) return undefined;

    let base = `${info.alias}.value`;
    let index = 1;

    while (!info.many && index < rest.length) {
      const child = info.children?.[rest[index]];
      if (!child) break;
      base = `${base}->'${rest[index]}'`;
      info = child;
      index++;
    }

    if (!info.many || index >= rest.length) return undefined;
    return {array: base, table: info.table, nested: rest.slice(index)};
  }

  /**
   * `EXISTS (… jsonb_array_elements(<relation>.value) …)` — does one element satisfy the condition. The
   * element side is cast to the target's declared type; comparing a date or a number as text is silently
   * wrong.
   */
  private existsOverMany(
    many: {array: string; table: TableSpec; nested: string[]},
    operator: string,
    left: Expression,
    right: Expression
  ): string {
    const element = relationFieldReference({alias: "el", table: many.table}, many.nested);
    const elementFirst = this.manyRelationField(left) !== undefined;
    const otherSql = this.visitValue(elementFirst ? right : left);

    const sqlOperator = operator === "==" ? "=" : operator === "!=" ? "IS DISTINCT FROM" : operator;
    const predicate = elementFirst
      ? `${element} ${sqlOperator} ${otherSql}`
      : `${otherSql} ${sqlOperator} ${element}`;

    return `EXISTS (SELECT 1 FROM jsonb_array_elements(${many.array}) AS el(value) WHERE ${predicate})`;
  }

  private arithmetic(node: Extract<Expression, {kind: "binary"}>): string {
    switch (node.operator) {
      case "+":
      case "-":
      case "*":
      case "/":
      case "%": {
        const op = node.operator === "%" ? "%" : node.operator;
        return `(${this.visitValue(node.left)} ${op} ${this.visitValue(node.right)})`;
      }
      default:
        throw unsupported(`binary operator '${node.operator}' as a value`);
    }
  }

  /** `document.title` → a column, `auth.identifier` → a constant at compile time. */
  private visitSelect(node: Extract<Expression, {kind: "select"}>): string {
    const path = flattenSelect(node);
    const [root, ...rest] = path;

    if (root === "auth") {
      // It belongs to the identity making the request, not to the row: we resolve the value now and bind it.
      let value: any = this.context.auth;
      for (const key of rest) value = value?.[key];
      return this.bind(value ?? null);
    }

    if (root !== "document") {
      throw unsupported(`unknown root identifier '${root}' (expected 'document' or 'auth')`);
    }

    const [column, ...nested] = rest;
    if (!column) throw unsupported("'document' without a property");

    return this.documentField(column, nested);
  }

  /** An SQL reference to a document field; the `document.x` chain and a bare `x` take the same path. */
  private documentField(column: string, nested: string[]): string {
    /**
     * A field of a resolved relation comes from the join's `to_jsonb(target)`; the relation **itself** is the
     * column, which carries the target's id.
     */
    const joined = nested.length ? this.context.relations?.[column] : undefined;
    if (joined) {
      return relationFieldReference(joined, nested);
    }

    /**
     * `_id` is a **valid field** although it is not in `table.columns`: the primary key is separate. Its type
     * is `char(24)`, so a text comparison is the right one.
     */
    if (column === "_id") {
      if (nested.length) {
        throw unsupported("nested access on '_id'");
      }
      return this.columnReference("_id");
    }

    const kind = this.columns.get(column);
    if (!kind) {
      throw unsupported(`'${column}' is not a property of this bucket`);
    }

    const reference = this.columnReference(column);

    // A translatable field: the value is a language map, resolved to the requested language.
    if (this.translated.has(column)) {
      const locale = this.context.locale;
      if (!locale) throw unsupported(`translated property '${column}' without a locale`);
      const base = `COALESCE(${reference}->>${this.bind(locale.best)}, ${reference}->>${this.bind(locale.fallback)})`;
      return nested.length ? jsonPath(base, nested, true) : base;
    }

    if (nested.length) {
      if (kind !== "json") {
        throw unsupported(`nested access on '${column}' (column kind '${kind}' is not json)`);
      }
      return jsonPath(reference, nested, true);
    }

    return reference;
  }

  private columnReference(column: string): string {
    const quoted = `"${column}"`;
    return this.context.alias ? `${this.context.alias}.${quoted}` : quoted;
  }

  // ── Builtin functions (the measured set: docs/expression-surface.md)
  private visitCallPredicate(node: Extract<Expression, {kind: "call"}>): string {
    switch (node.callee) {
      case "regex":
        return this.regex(node);
      case "some":
        return this.arrayOverlap(node, "some");
      case "every":
        return this.arrayOverlap(node, "every");
      case "equal":
        return this.arrayEqual(node);
      case "has":
        return this.has(node);
      default:
        throw unsupported(`builtin '${node.callee}' as a predicate`);
    }
  }

  private visitCallValue(node: Extract<Expression, {kind: "call"}>): string {
    switch (node.callee) {
      case "length":
        return this.length(node);
      case "now":
        return "now()";
      case "unixTime":
        return `(EXTRACT(EPOCH FROM ${this.visitValue(node.arguments[0])}))`;
      default:
        throw unsupported(`builtin '${node.callee}' as a value`);
    }
  }

  private regex(node: Extract<Expression, {kind: "call"}>): string {
    const [target, pattern, flags] = node.arguments;
    const insensitive = flags && flags.kind === "literal" && String(flags.value).includes("i");
    // PostgreSQL uses POSIX ARE, Mongo PCRE; the supported subset is part of the contract.
    return `(${this.visitValue(target)} ${insensitive ? "~*" : "~"} ${this.visitValue(pattern)})`;
  }

  /**
   * `some(document.tags, ["a","b"])` → is there an intersection · `every(...)` → does it contain all of
   * them. On native array columns the `&&` and `@>` operators can be indexed with GIN.
   */
  private arrayOverlap(node: Extract<Expression, {kind: "call"}>, fn: "some" | "every"): string {
    const [target, values] = node.arguments;
    const column = this.visitValue(target);
    const list = this.arrayLiteral(values, fn);
    return fn === "some" ? `(${column} && ${list})` : `(${column} @> ${list})`;
  }

  private arrayEqual(node: Extract<Expression, {kind: "call"}>): string {
    const [target, values] = node.arguments;
    return `(${this.visitValue(target)} = ${this.arrayLiteral(values, "equal")})`;
  }

  private arrayLiteral(node: Expression, fn: string): string {
    if (node.kind === "list") {
      const items = node.elements.map(element => {
        if (element.kind !== "literal") {
          throw unsupported(`non-literal element in '${fn}' argument`);
        }
        return this.bind(element.value);
      });
      return `ARRAY[${items.join(", ")}]`;
    }
    if (node.kind === "select") return this.visitSelect(node);
    throw unsupported(`'${node.kind}' as the list argument of '${fn}'`);
  }

  private has(node: Extract<Expression, {kind: "call"}>): string {
    const [target] = node.arguments;
    if (target.kind !== "select") throw unsupported("'has' expects a property access chain");
    return `(${this.visitSelect(target)} IS NOT NULL)`;
  }

  private length(node: Extract<Expression, {kind: "call"}>): string {
    const [target] = node.arguments;
    const reference = this.visitValue(target);
    const column = target.kind === "select" ? flattenSelect(target)[1] : undefined;
    const kind = column ? this.columns.get(column) : undefined;
    if (kind === "textArray" || kind === "numberArray") {
      return `COALESCE(array_length(${reference}, 1), 0)`;
    }
    if (kind === "text") return `length(${reference})`;
    if (kind === "json") return `COALESCE(jsonb_array_length(${reference}), 0)`;
    throw unsupported(`'length' on column kind '${kind}'`);
  }

  /**
   * An `ObjectId` is bound **as hex**: `pg` sends an unrecognized object through `JSON.stringify`, which
   * makes the parameter a quoted string that never matches a `char(24)` column, and the filter silently
   * returns nothing. The same rule holds on every binding path in the driver.
   */
  private bind(value: unknown): string {
    if (value === null || value === undefined) return "NULL";
    this.params.push(hexIfObjectId(value));
    return `$${(this.context.paramOffset ?? 0) + this.params.length}`;
  }
}

/** A relation declared to the compiler: the alias, the target definition, whether it is an array, and its children. */
export interface RelationInfo {
  alias: string;
  table: TableSpec;
  many?: boolean;
  children?: Record<string, RelationInfo>;
}

/** `document.meta.note` → `["document","meta","note"]` */
export function flattenSelect(node: Expression): string[] {
  if (node.kind === "identifier") return [node.name];
  if (node.kind === "select") return [...flattenSelect(node.left), node.right.name];
  throw unsupported(`'${node.kind}' inside a property access chain`);
}

/** `meta`, `["a","b"]` → `meta->'a'->>'b'` (the last step as text). */
/**
 * A reference to a resolved relation's field, **typed** from the target's schema: `->>` returns text, and a
 * number or timestamp cannot be compared as text. An unknown type keeps the text comparison.
 */
function relationFieldReference(
  joined: {alias: string; table: TableSpec},
  nested: string[]
): string {
  const base = jsonPath(`${joined.alias}.value`, nested, true);

  if (nested.length !== 1) {
    return base;
  }

  const kind = joined.table.columns.find(column => column.name === nested[0])?.kind;

  if (kind === "timestamp") return `(${base})::timestamptz`;
  if (kind === "number") return `(${base})::double precision`;
  if (kind === "boolean") return `(${base})::boolean`;

  return base;
}

function jsonPath(base: string, path: string[], asText: boolean): string {
  const head = path
    .slice(0, -1)
    .map(key => `->'${key}'`)
    .join("");
  const last = path[path.length - 1];
  return `${base}${head}${asText ? "->>" : "->"}'${last}'`;
}

function unsupported(detail: string): UnsupportedExpressionError {
  return new UnsupportedExpressionError(detail, "postgres");
}
