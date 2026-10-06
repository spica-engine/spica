import {ColumnKind, TableSpec, UnsupportedExpressionError} from "@spica-server/database-driver";
import {SYSTEM_SCHEMA} from "../schema/naming.js";
import {SqlFragment} from "./expression-to-sql.js";
import {hexIfObjectId} from "../schema/codec.js";
import {compileElementCondition} from "./crud-filter-to-sql.js";

/** An internal CRUD update expression → a `SET` clause; the closed set of operators the codebase uses. */
const SUPPORTED = new Set([
  "$set",
  "$unset",
  "$inc",
  "$push",
  "$pull",
  "$addToSet",
  "$setOnInsert",
  "$sort"
]);

export interface UpdateCompileContext {
  table: TableSpec;
  paramOffset?: number;
  /**
   * Whether the caller asked for an upsert. It does not change the `SET` clause; it makes an update that
   * assigns nothing a no-op rather than an error.
   */
  upsert?: boolean;
}

export function compileCrudUpdate(
  update: Record<string, any>,
  context: UpdateCompileContext
): SqlFragment {
  if (Array.isArray(update)) return compileUpdatePipeline(update, context);

  const state = new UpdateState(context);
  const assignments = state.visit(update);
  if (!assignments.length) {
    /**
     * An update that assigns nothing is a **no-op**, as in Mongo: `$setOnInsert` applies on insert only and
     * `$sort` is a `$push` modifier. `writeColumns` then resolves "did a row match" with a read, because an
     * `UPDATE` that assigns nothing cannot report it. An empty update document stays loud.
     */
    if (!Object.keys(update).length) {
      throw new UnsupportedExpressionError("an update with no applicable operators", "postgres");
    }
    return {sql: "", params: []};
  }
  return {sql: assignments.join(", "), params: state.params};
}

/**
 * An **aggregation pipeline** update (`updateMany(filter, [{$set: …}])`) — one recognized shape, and a loud
 * error for the rest. An unrecognized pipeline must never fall through to the operator-document path: an
 * array's keys are not `$`-prefixed, which reads as a replacement document and nulls every real column.
 *
 * The recognized shape is `storage.service.ts`'s folder rename:
 *
 * ```
 * [{$set: {name: {$cond: [{$eq: ["$name", old]}, new,
 *                         {$replaceOne: {input: "$name", find: old, replacement: new}}]}}}]
 * ```
 *
 * matched structurally, as the aggregate compiler matches its idioms.
 */
function compileUpdatePipeline(pipeline: object[], context: UpdateCompileContext): SqlFragment {
  const rename = matchRenamePipeline(pipeline);
  if (!rename) {
    throw new UnsupportedExpressionError(`update pipeline ${JSON.stringify(pipeline)}`, "postgres");
  }

  const {field, from, to} = rename;
  const kind = context.table.columns.find(column => column.name === field)?.kind;
  if (kind !== "text") {
    throw new UnsupportedExpressionError(
      `update pipeline on '${field}' whose column kind is '${kind}'`,
      "postgres"
    );
  }

  const column = `"${field}"`;
  /**
   * `$replaceOne` replaces the **first** occurrence. `position`/`overlay` rather than `regexp_replace` keeps
   * both values plain parameters — a regex would have to escape whatever the user named their folder.
   */
  const sql =
    `${column} = CASE ` +
    `WHEN ${column} = $1 THEN $2 ` +
    `WHEN position($1 in ${column}) > 0 ` +
    `THEN overlay(${column} placing $2 from position($1 in ${column}) for length($1)) ` +
    `ELSE ${column} END`;

  return {sql, params: [from, to]};
}

/** The rename pipeline, matched structurally; `undefined` when the shape is anything else. */
function matchRenamePipeline(
  pipeline: object[]
): {field: string; from: string; to: string} | undefined {
  if (pipeline.length !== 1) return undefined;

  const set = (pipeline[0] as any)?.$set;
  if (!set || typeof set !== "object") return undefined;

  const entries = Object.entries(set);
  if (entries.length !== 1) return undefined;

  const [field, expression] = entries[0] as [string, any];
  const cond = expression?.$cond;
  if (!Array.isArray(cond) || cond.length !== 3) return undefined;

  const [test, whenEqual, otherwise] = cond;
  const eq = test?.$eq;
  if (!Array.isArray(eq) || eq.length !== 2) return undefined;
  if (eq[0] !== `$${field}` || typeof eq[1] !== "string") return undefined;
  if (typeof whenEqual !== "string") return undefined;

  const replace = otherwise?.$replaceOne;
  if (!replace) return undefined;
  if (replace.input !== `$${field}`) return undefined;
  if (replace.find !== eq[1] || replace.replacement !== whenEqual) return undefined;

  return {field, from: eq[1], to: whenEqual};
}

class UpdateState {
  readonly params: unknown[] = [];
  private kinds = new Map<string, ColumnKind>();
  /** Column → the nested form of the path writes made to that column. */
  private jsonTargets = new Map<string, string>();

  /** The `json` columns whose key order is meaningful; writing a sub-path requires a cast. */
  private orderedJson = new Set<string>();

  constructor(private context: UpdateCompileContext) {
    for (const column of context.table.columns) {
      this.kinds.set(column.name, column.kind);
      if (column.orderedJson) this.orderedJson.add(`"${column.name}"`);
    }
    /**
     * `_id` is the implicit primary key and absent from `TableSpec.columns`. Registering it keeps it from
     * being taken for an undeclared field and written into the overflow column, from where the codec would
     * merge it back over the row as a **string**.
     */
    this.kinds.set("_id", "reference");
  }

  visit(update: Record<string, any>): string[] {
    const assignments: (string | undefined)[] = [];
    let replacement: Record<string, any> | undefined;

    for (const [operator, operand] of Object.entries(update)) {
      if (!operator.startsWith("$")) {
        // A document with no operator = a full replace (`replaceOne` semantics).
        replacement = replacement || {};
        replacement[operator] = operand;
        continue;
      }
      if (!SUPPORTED.has(operator)) {
        throw new UnsupportedExpressionError(`update operator '${operator}'`, "postgres");
      }
      assignments.push(...this.operator(operator, operand));
    }

    if (replacement) {
      const overflow = this.context.table.overflowColumn;

      // Built from scratch: a replace deletes the old undeclared fields too.
      if (overflow) {
        this.jsonTargets.set(`"${overflow}"`, "'{}'::jsonb");
      }

      for (const [field, value] of Object.entries(replacement)) {
        if (field === "_id") continue;
        // The operator-less (replace) path uses the overflow column too; the same behaviour as `$set`.
        assignments.push(this.set(field, value));
      }

      /**
       * The columns **not** in the document are set to `NULL`: a replace swaps the whole document, so an
       * omitted field disappears. Writing only the given fields would behave like `$set` and keep the old
       * value silently.
       */
      for (const column of this.context.table.columns) {
        if (column.name in replacement) continue;
        if (overflow && column.name === overflow) continue;
        if (this.jsonTargets.has(`"${column.name}"`)) continue;
        assignments.push(`"${column.name}" = NULL`);
      }
    }

    /**
     * Several sub-paths written to the same jsonb column become **one** assignment, by nesting the
     * `jsonb_set`s: `SET "options" = …, "options" = …` is `42701 column specified more than once`.
     */
    for (const [column, expression] of this.jsonTargets) {
      assignments.push(
        this.orderedJson.has(column)
          ? `${column} = (${expression})::json`
          : `${column} = ${expression}`
      );
    }

    return assignments.filter((assignment): assignment is string => assignment !== undefined);
  }

  private operator(operator: string, operand: any): (string | undefined)[] {
    switch (operator) {
      case "$set":
        return Object.entries(operand).map(([field, value]) => this.set(field, value));

      case "$setOnInsert":
        /**
         * **Never an assignment:** `$setOnInsert` applies only when an upsert inserts, and that insert is
         * built by `upsertSeed`. Applying it on a matching row is silently destructive — it would reset the
         * default identity's password on every boot.
         */
        return [];

      case "$unset":
        return Object.keys(operand).map(field => this.unset(field));

      case "$inc":
        return Object.entries(operand).map(([field, value]) => this.increment(field, value));

      case "$push":
      case "$addToSet":
        return Object.entries(operand).map(([field, value]) => this.append(operator, field, value));

      case "$pull":
        return Object.entries(operand).map(([field, value]) => this.pull(field, value));

      case "$sort":
        // `$sort` is only meaningful as a `$push` modifier; on its own it is ignored (Mongo behaves the
        // same way: `$push: {f: {$each: [...], $sort: 1}}`).
        return [];

      default:
        throw new UnsupportedExpressionError(`update operator '${operator}'`, "postgres");
    }
  }

  private set(field: string, value: any): string | undefined {
    // An undeclared field is written to the overflow column (the safety net).
    if (this.isOverflow(field)) return this.setOverflow(field, value);

    // Writing to the sub-path of a declared `json` column: `{$set: {"options.foo": …}}`.
    const [root, ...rest] = field.split(".");
    if (rest.length && this.kinds.get(root) === "json") {
      return this.setJsonPath(root, rest, value);
    }

    this.assertNotAlsoPathAssigned(root);

    if (value === null) return `${this.column(field)} = NULL`;

    /**
     * A value written to a `json` column is stringified: `pg` turns a JS array into a Postgres array literal,
     * which a json column rejects. `text[]`/`double precision[]` columns keep `pg`'s own behaviour.
     */
    if (this.kinds.get(field.split(".")[0]) === "json") {
      /**
       * `::json` on an ordered column, `::jsonb` otherwise. The cast happens **before** the column sees the
       * value, so a `::jsonb` cast re-sorts the keys even on a `json` column — which would reorder the
       * bucket's fields as the panel shows them.
       */
      const cast = this.orderedJson.has(this.column(field)) ? "json" : "jsonb";
      return `${this.column(field)} = ${this.bind(JSON.stringify(value))}::${cast}`;
    }

    // The update path does not go through the codec, so the id conversion is needed here too.
    const kind = this.kinds.get(field);
    const bound = kind === "text" || kind === "reference" ? hexIfObjectId(value) : value;
    return `${this.column(field)} = ${this.bind(bound)}`;
  }

  /**
   * Is the field undeclared and does the table have an overflow column? Without one an undeclared field
   * raises rather than being dropped.
   */
  private isOverflow(field: string): boolean {
    const overflow = this.context.table.overflowColumn;
    if (!overflow) return false;
    const [name] = field.split(".");
    return !this.kinds.has(name) && name !== overflow;
  }

  /**
   * Writing to the overflow column with `jsonb_set`. The `COALESCE` is necessary: if the column starts out
   * `NULL`, `jsonb_set(NULL, …)` returns `NULL` too and the write disappears silently.
   */
  private setOverflow(field: string, value: any): undefined {
    const overflow = `"${this.context.table.overflowColumn}"`;
    const path = this.bind(`{${field.split(".").join(",")}}`);
    const payload = this.bind(JSON.stringify(value === undefined ? null : value));
    return this.foldJson(
      overflow,
      base => `jsonb_set(${base}, ${path}::text[], ${payload}::jsonb, true)`
    );
  }

  /** Writing to a json column's sub-path. `create_missing = true`, because Mongo's `$set` creates the path. */
  private setJsonPath(root: string, path: string[], value: any): undefined {
    const pathParam = this.bind(`{${path.join(",")}}`);
    const payload = this.bind(JSON.stringify(value === undefined ? null : value));
    return this.foldJson(
      `"${root}"`,
      base => `jsonb_set(${base}, ${pathParam}::text[], ${payload}::jsonb, true)`
    );
  }

  /**
   * Accumulates the path writes to a jsonb column into one assignment. The **`COALESCE` on the first layer
   * is required**: `jsonb_set(NULL, …)` returns `NULL`, so the write would disappear silently.
   */
  private foldJson(column: string, wrap: (base: string) => string, seed?: string): undefined {
    /**
     * An ordered column is physically `json`, and `jsonb_set` only works on `jsonb`, so it is entered with
     * `::jsonb` and cast back. The order is lost on that round trip — see `ColumnSpec.orderedJson`.
     */
    const ordered = this.orderedJson.has(column);
    const start =
      seed ??
      (ordered ? `COALESCE(${column}::jsonb, '{}'::jsonb)` : `COALESCE(${column}, '{}'::jsonb)`);
    const base = this.jsonTargets.get(column) || start;
    this.jsonTargets.set(column, wrap(base));
    return undefined;
  }

  /**
   * Writing both a whole value and a sub-path to one column leaves it undefined which wins; Mongo calls that
   * a conflict too.
   */
  private assertNotAlsoPathAssigned(root: string): void {
    if (this.jsonTargets.has(`"${root}"`)) {
      throw new UnsupportedExpressionError(
        `both a whole-value and a sub-path assignment to '${root}' in one update`,
        "postgres"
      );
    }
  }

  /**
   * `$inc` splits into two paths: a plain column, and the **sub-path** of a declared `json` column.
   *
   * The second one was missing and it has a real caller: `status/services/src/service.ts` sends
   * `{$inc: {count: 1, "request.size": n, "response.size": n}}` — `request`/`response` are jsonb columns. The
   * dotted path was being rejected in `column()`, which meant the counter of every API request could not be
   * written on PG.
   *
   * `jsonb` cannot add to a numeric sub-field directly: the value is extracted as `numeric`, added, and
   * written back as `jsonb`. Without the `COALESCE` the first increment produced `NULL` and disappeared
   * silently.
   */
  private increment(field: string, value: any): string | undefined {
    const [root, ...rest] = field.split(".");

    if (rest.length && this.kinds.get(root) === "json") {
      const path = this.bind(`{${rest.join(",")}}`);
      const amount = this.bind(value);
      const current = `COALESCE((${`"${root}"`} #>> ${path})::numeric, 0)`;
      return this.foldJson(
        `"${root}"`,
        base => `jsonb_set(${base}, ${path}::text[], to_jsonb(${current} + ${amount}), true)`
      );
    }

    const column = this.column(field);
    return `${column} = COALESCE(${column}, 0) + ${this.bind(value)}`;
  }

  /**
   * Three paths: an overflow field, the sub-path of a declared `json` column (a deleted language arrives as
   * `{$unset: {"title.tr_TR": ""}}`), and a plain column.
   */
  private unset(field: string): string | undefined {
    if (this.isOverflow(field)) return this.unsetOverflow(field);

    const [root, ...rest] = field.split(".");
    if (rest.length && this.kinds.get(root) === "json") {
      const path = this.bind(`{${rest.join(",")}}`);

      /**
       * A `$[]` (positional-all) path is not fixed: every array element has to be walked, and `#-` produces
       * valid SQL that deletes **nothing**. `spica.jsonb_unset_deep` is the recursive counterpart.
       *
       * No `COALESCE` here on purpose: the helper returns `NULL` on `NULL`, and turning a field that was
       * never written into an empty object would be wrong.
       */
      if (rest.includes("$[]")) {
        return this.foldJson(
          `"${root}"`,
          base => `${SYSTEM_SCHEMA}.jsonb_unset_deep(${base}, ${path}::text[])`,
          `"${root}"`
        );
      }

      return this.foldJson(`"${root}"`, base => `${base} #- ${path}::text[]`);
    }

    return `${this.column(field)} = NULL`;
  }

  /** Deleting an overflow field: `$unset` lands on this path. */
  private unsetOverflow(field: string): undefined {
    const overflow = `"${this.context.table.overflowColumn}"`;
    const path = this.bind(`{${field.split(".").join(",")}}`);
    return this.foldJson(overflow, base => `${base} #- ${path}::text[]`);
  }

  private append(operator: string, field: string, value: any): string {
    const kind = this.kinds.get(field);
    const column = this.column(field);
    // The `{$each: [...]}` modifier: several elements.
    const values = isEach(value) ? value.$each : [value];

    if (kind === "textArray" || kind === "numberArray") {
      // An element of a text array can be an id (`function.env_vars`); the stored representation is hex.
      const list = `ARRAY[${values.map((v: any) => this.bind(hexIfObjectId(v))).join(", ")}]`;
      if (operator === "$addToSet") {
        // Prevent a duplicate insertion: add only the ones that do not exist.
        return `${column} = (SELECT array_agg(DISTINCT e) FROM unnest(COALESCE(${column}, '{}') || ${list}) e)`;
      }
      return `${column} = COALESCE(${column}, '{}') || ${list}`;
    }

    if (kind === "json") {
      return `${column} = COALESCE(${column}, '[]'::jsonb) || ${this.bind(JSON.stringify(values))}::jsonb`;
    }

    throw new UnsupportedExpressionError(`'${operator}' on column kind '${kind}'`, "postgres");
  }

  private pull(field: string, value: any): string {
    const kind = this.kinds.get(field);
    const column = this.column(field);

    if (kind === "textArray" || kind === "numberArray") {
      // As in `append`: an element of a text array can be an id, stored as hex.
      return `${column} = array_remove(${column}, ${this.bind(hexIfObjectId(value))})`;
    }
    /**
     * **Conditional** removal from a `jsonb` array. The condition has the same shape as `$elemMatch` in a
     * filter, so the shared helper compiles it.
     *
     * `COALESCE(…, '[]')` is required: `jsonb_agg` over nothing returns `NULL` and the column would silently
     * become `NULL`, while Mongo leaves an empty array that the caller matches with `{$size: 0}`.
     */
    if (kind === "json") {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new UnsupportedExpressionError(
          `'$pull' on a json column expects an element condition, got ${JSON.stringify(value)}`,
          "postgres"
        );
      }

      const condition = compileElementCondition(value, "e", element => this.bind(element));
      return `${column} = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(${column}) e WHERE NOT (${condition})), '[]'::jsonb)`;
    }

    throw new UnsupportedExpressionError(`'$pull' on column kind '${kind}'`, "postgres");
  }

  private column(field: string): string {
    const [name] = field.split(".");
    if (!this.kinds.has(name)) {
      throw new UnsupportedExpressionError(
        `'${name}' is not a property of this bucket`,
        "postgres"
      );
    }
    if (field.includes(".")) {
      throw new UnsupportedExpressionError(
        `nested update path '${field}' (use jsonb_set at the driver level)`,
        "postgres"
      );
    }
    return `"${name}"`;
  }

  private bind(value: unknown): string {
    this.params.push(value);
    return `$${(this.context.paramOffset ?? 0) + this.params.length}`;
  }
}

function isEach(value: any): value is {$each: any[]} {
  return typeof value === "object" && value !== null && Array.isArray(value.$each);
}
