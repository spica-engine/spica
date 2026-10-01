import {
  ColumnKind,
  fromMongoAggExpression,
  isId,
  TableSpec,
  UnsupportedExpressionError
} from "@spica-server/database-driver";
import {compileExpression, SqlFragment} from "./expression-to-sql.js";
import {hexIfObjectId} from "../schema/codec.js";

/**
 * The internal CRUD filter → `WHERE`.
 *
 * The source is the closed set **our own service code** uses, not the free Mongo JSON a user sends: we wrote
 * the call sites, so we choose the semantics. An operator not on the list is rejected, and a new one is added
 * here first — `scripts/collect-expression-surface.mjs` catches the drift.
 */
export interface CrudCompileContext {
  table: TableSpec;
  alias?: string;
  paramOffset?: number;
}

/** The measured query operators — `docs/expression-surface.md`. */
const SUPPORTED = new Set([
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  // The `activity` controller sends `$all` on an array column; it was added to the measurement later.
  "$all",
  "$and",
  "$or",
  "$nor",
  "$not",
  "$exists",
  "$regex",
  "$options",
  "$size",
  "$type",
  "$elemMatch",
  "$mod",
  "$expr"
]);

export function compileCrudFilter(
  filter: Record<string, any> | undefined,
  context: CrudCompileContext
): SqlFragment {
  assertFilterDocument(filter);
  const state = new FilterState(context);
  const sql = state.visitFilter(filter || {});
  return {sql, params: state.params};
}

/**
 * A BSON value is not a filter document: `Object.entries(new ObjectId())` is `[["buffer", <bytes>]]`, which
 * would compile the id's raw bytes into the query. `find`/`findOne` normalize a bare id beforehand, as the
 * MongoDB driver does; every other operation rejects it here, as MongoDB does too.
 */
function assertFilterDocument(filter: unknown): void {
  if (filter === undefined || filter === null) return;
  const bsontype = (filter as {_bsontype?: unknown})._bsontype;
  if (typeof bsontype !== "string") return;
  throw new UnsupportedExpressionError(
    `a bare ${bsontype} as a filter; use {_id: value}`,
    "postgres"
  );
}

/** `find`/`findOne` take a bare id as a filter on `_id` — the rationale is in `assertFilterDocument`. */
export function normalizeIdFilter(filter: unknown): Record<string, any> | undefined {
  return isId(filter) ? {_id: filter} : (filter as Record<string, any> | undefined);
}

class FilterState {
  readonly params: unknown[] = [];
  private kinds = new Map<string, ColumnKind>();

  constructor(private context: CrudCompileContext) {
    for (const column of context.table.columns) this.kinds.set(column.name, column.kind);
    this.kinds.set("_id", "reference");
  }

  /**
   * `$expr` — the aggregation expression inside it becomes the **canonical tree** and goes to the CEL
   * compiler. A second expression compiler here would let the same expression produce two different `WHERE`
   * clauses. The realtime path is what produces it, and it does not go through `ReadPlan`.
   */
  private expr(value: any): string {
    const fragment = compileExpression(fromMongoAggExpression(value), {
      table: this.context.table,
      alias: this.context.alias,
      paramOffset: (this.context.paramOffset || 0) + this.params.length
    });
    this.params.push(...fragment.params);
    return `(${fragment.sql})`;
  }

  visitFilter(filter: Record<string, any>): string {
    const clauses: string[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (key.startsWith("$")) {
        clauses.push(this.logical(key, value));
        continue;
      }
      clauses.push(this.field(key, value));
    }

    return clauses.length ? clauses.join(" AND ") : "TRUE";
  }

  private logical(operator: string, value: any): string {
    this.assertSupported(operator);
    switch (operator) {
      case "$and":
        return `(${(value as any[]).map(v => this.visitFilter(v)).join(" AND ")})`;
      case "$or":
        return `(${(value as any[]).map(v => this.visitFilter(v)).join(" OR ")})`;
      case "$nor":
        return `NOT (${(value as any[]).map(v => this.visitFilter(v)).join(" OR ")})`;
      case "$expr":
        return this.expr(value);
      default:
        throw unsupported(`top-level operator '${operator}'`);
    }
  }

  /** `{views: 5}` ya da `{views: {$gt: 5}}` */
  private field(path: string, value: any): string {
    const reference = this.reference(path);

    if (!isOperatorObject(value)) {
      if (value === null) return `${reference} IS NULL`;
      /**
       * A plain value on an array column means **membership**: in a document store `{tickets: id}` asks
       * "does the array contain this id", not equality. Because `onetomany` relations are array columns
       * `clearRelations` sends this shape, and compiling it to equality would silently return nothing.
       */
      const kind = this.kinds.get(path.split(".")[0]);
      if (kind === "textArray" || kind === "numberArray") {
        return `${this.bind(path, value)} = ANY(${reference})`;
      }
      return `${reference} = ${this.bind(path, value)}`;
    }

    const clauses: string[] = [];
    const operators = value as Record<string, any>;

    for (const [operator, operand] of Object.entries(operators)) {
      // `$options` is meaningless on its own; it is read together with `$regex`.
      if (operator === "$options") continue;
      this.assertSupported(operator);
      clauses.push(this.comparison(path, reference, operator, operand, operators));
    }

    return clauses.length === 1 ? clauses[0] : `(${clauses.join(" AND ")})`;
  }

  private comparison(
    path: string,
    reference: string,
    operator: string,
    operand: any,
    siblings: Record<string, any>
  ): string {
    switch (operator) {
      case "$eq":
        return operand === null
          ? `${reference} IS NULL`
          : `${reference} = ${this.bind(path, operand)}`;
      case "$ne":
        return operand === null
          ? `${reference} IS NOT NULL`
          : `(${reference} IS DISTINCT FROM ${this.bind(path, operand)})`;
      case "$gt":
        return `${reference} > ${this.bind(path, operand)}`;
      case "$gte":
        return `${reference} >= ${this.bind(path, operand)}`;
      case "$lt":
        return `${reference} < ${this.bind(path, operand)}`;
      case "$lte":
        return `${reference} <= ${this.bind(path, operand)}`;

      case "$in":
        return this.membership(path, reference, operand, false);
      case "$nin":
        return this.membership(path, reference, operand, true);

      case "$all": {
        /**
         * `$in` is intersection (`&&`), `$all` is **containment** (`@>`): the two are used together on the
         * same column (the `activity` controller sends `{resource: {$all: […], $in: […]}}`) and confusing
         * the difference would be a silent data difference.
         */
        const kind = this.kinds.get(path);
        if (kind !== "textArray" && kind !== "numberArray") {
          throw unsupported(`'$all' on column kind '${kind}' (array columns only)`);
        }
        const values = (operand as any[]) || [];
        // An empty `$all` matches no row — the same as `$in: []`, the opposite of `$nin: []`.
        if (!values.length) return "FALSE";
        const list = `ARRAY[${values.map(v => this.bind(path, v)).join(", ")}]`;
        return `(${reference} @> ${list})`;
      }

      case "$exists":
        // In Mongo this is "does the field exist"; in a relational model the column always exists → whether it is NULL.
        return operand ? `${reference} IS NOT NULL` : `${reference} IS NULL`;

      case "$regex": {
        const flags = siblings.$options;
        const insensitive = typeof flags === "string" && flags.includes("i");
        const pattern = operand instanceof RegExp ? operand.source : operand;
        return `(${reference} ${insensitive ? "~*" : "~"} ${this.bind(path, pattern)})`;
      }

      case "$size": {
        const kind = this.kinds.get(path);
        if (kind === "textArray" || kind === "numberArray") {
          return `COALESCE(array_length(${reference}, 1), 0) = ${this.bind(path, operand)}`;
        }
        if (kind === "json") {
          return `COALESCE(jsonb_array_length(${reference}), 0) = ${this.bind(path, operand)}`;
        }
        throw unsupported(`'$size' on column kind '${kind}'`);
      }

      case "$not":
        return `NOT (${this.field(path, operand)})`;

      case "$mod": {
        const [divisor, remainder] = operand as [number, number];
        return `((${reference} % ${this.bind(path, divisor)}) = ${this.bind(path, remainder)})`;
      }

      case "$type":
        // A BSON type check; it has no counterpart in a relational model, where a column's type is fixed.
        throw unsupported("'$type' (column types are fixed in the relational model)");

      case "$elemMatch": {
        /**
         * Element matching in a `json` array → `EXISTS (… jsonb_array_elements …)`.
         *
         * The single caller is `bucket/history`: `{changes: {$elemMatch: {"path.0": "title"}}}`. The
         * condition is **scalar equality** of dotted paths combined with `AND`; the set is finite and the
         * rationale is in `compileElementCondition`.
         */
        const kind = this.kinds.get(path);
        if (kind !== "json") {
          throw unsupported(`'$elemMatch' on column kind '${kind}'`);
        }

        const condition = compileElementCondition(operand, "e", value => this.bind(path, value));
        return `EXISTS (SELECT 1 FROM jsonb_array_elements(${reference}) e WHERE ${condition})`;
      }

      default:
        throw unsupported(`operator '${operator}'`);
    }
  }

  /**
   * `$in`/`$nin`: **intersection** on an array column, `= ANY` on a scalar column.
   *
   * In Mongo `{tags: {$in: ["a"]}}` matches one of the elements on an array field; on a native array column
   * the counterpart of that is `&&` (intersection), not `= ANY`.
   */
  private membership(path: string, reference: string, operand: any, negate: boolean): string {
    const values = (operand as any[]) || [];
    const kind = this.kinds.get(path);
    const isArrayColumn = kind === "textArray" || kind === "numberArray";

    if (!values.length) return negate ? "TRUE" : "FALSE";

    if (isArrayColumn) {
      const list = `ARRAY[${values.map(v => this.bind(path, v)).join(", ")}]`;
      return negate ? `NOT (${reference} && ${list})` : `(${reference} && ${list})`;
    }

    const list = `(${values.map(v => this.bind(path, v)).join(", ")})`;
    return negate
      ? `(${reference} NOT IN ${list} OR ${reference} IS NULL)`
      : `${reference} IN ${list}`;
  }

  /** `meta.note` → `"meta"->>'note'`; a plain field → `"field"`. */
  private reference(path: string): string {
    const [column, ...nested] = path.split(".");
    const kind = this.kinds.get(column);

    /**
     * An undeclared field is read from the overflow column (AK-8). On a table with no overflow column it
     * still raises: filtering on a schemaless field must not stay silent, per K-4.
     *
     * `->>` returns text, so overflow fields are compared **as text**. A numeric comparison would need type
     * information and, by the overflow's definition, that information does not exist; this limit is
     * deliberate and declared.
     */
    if (!kind) {
      const overflow = this.context.table.overflowColumn;
      if (!overflow) throw unsupported(`'${column}' is not a property of this bucket`);

      const base = this.context.alias ? `${this.context.alias}."${overflow}"` : `"${overflow}"`;
      const segments = [column, ...nested];
      const head = segments
        .slice(0, -1)
        .map(k => `->'${k}'`)
        .join("");
      return `${base}${head}->>'${segments[segments.length - 1]}'`;
    }

    const quoted = this.context.alias ? `${this.context.alias}."${column}"` : `"${column}"`;
    if (!nested.length) return quoted;
    if (kind !== "json") {
      throw unsupported(`nested path '${path}' on column kind '${kind}'`);
    }
    const head = nested
      .slice(0, -1)
      .map(k => `->'${k}'`)
      .join("");
    return `${quoted}${head}->>'${nested[nested.length - 1]}'`;
  }

  /** `_id` and relation columns are `char(24)`: an ObjectId is reduced to hex. */
  private bind(path: string, value: unknown): string {
    const kind = this.kinds.get(path.split(".")[0]);
    /**
     * `text` included: the codebase writes ids into some text columns (`activity.identifier`,
     * `verification.userId`). Because the write side stores hex, the filter has to compare hex too; when they
     * diverged the query silently returned nothing.
     */
    const textBacked =
      kind === "reference" || kind === "text" || kind === "textArray" || path === "_id";
    this.params.push(textBacked ? hexIfObjectId(value) : value);
    return `$${(this.context.paramOffset ?? 0) + this.params.length}`;
  }

  private assertSupported(operator: string): void {
    if (!SUPPORTED.has(operator)) throw unsupported(`operator '${operator}'`);
  }
}

function isOperatorObject(value: any): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !("toHexString" in value) &&
    Object.keys(value).some(key => key.startsWith("$"))
  );
}

function unsupported(detail: string): UnsupportedExpressionError {
  return new UnsupportedExpressionError(detail, "postgres");
}

/**
 * The condition to apply to an element of a `jsonb` array: dotted paths → scalar equality, combined with
 * `AND`.
 *
 * `$elemMatch` (a filter) and a conditional `$pull` (an update) use the **same** shape; the single caller is
 * `bucket/history`'s match over its `path` array.
 *
 * **A declared limit:** the comparison is made **as text**, through `#>>`. The types of the values inside an
 * element are not declared in the schema (the array is free-form in a `json` column), so the type
 * information a numeric comparison would need is not there — the same limit as on the overflow column.
 */
export function compileElementCondition(
  paths: Record<string, unknown>,
  alias: string,
  bind: (value: unknown) => string
): string {
  const entries = Object.entries(paths);
  if (!entries.length) {
    throw unsupported("an element condition without any path");
  }

  return entries
    .map(([path, value]) => {
      if (value !== null && typeof value === "object") {
        throw unsupported(`element condition on '${path}' with a non-scalar value`);
      }
      const jsonPath = `{${path.split(".").join(",")}}`;
      return `${alias} #>> '${jsonPath}' = ${bind(value)}`;
    })
    .join(" AND ");
}
