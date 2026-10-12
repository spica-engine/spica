import {TableSpec, UnsupportedExpressionError} from "@spica-server/database-driver";
import {BUCKET_SCHEMA} from "../schema/naming.js";
import {compileCrudFilter} from "./crud-filter-to-sql.js";
import {SqlFragment} from "./expression-to-sql.js";

/**
 * A **finite subset** of the aggregation pipeline → SQL. The pipelines come out of `PipelineBuilder`, so
 * this is an internal surface, not a user-facing one.
 *
 * **What falls outside the subset raises; it is never skipped.** A stage such as a general `$group` is
 * `ReadPlan`'s job, and imitating it here would grow a second half-finished read engine.
 */
export interface AggregateContext {
  table: TableSpec;
  /** The table, qualified with its schema name; comes from the collection. */
  qualified: string;
  /**
   * The `$lookup` target's definition, needed to check that the joined field is a column whose type
   * matches the local one — otherwise the codec decodes the row as the wrong type.
   */
  resolveTarget?(collection: string): TableSpec | undefined;
}

const SUPPORTED = new Set(["$match", "$sort", "$skip", "$limit", "$project", "$count"]);

/**
 * The `$facet` plan: data and count as **separate** queries, because `count(*) OVER ()` materializes every
 * matching row and measured 38% slower. Only `{meta: [{$count: "..."}], data: [...stages]}` is recognized.
 */
export interface FacetPlan {
  kind: "facet";
  metaField: string;
  data: SqlFragment;
  count: SqlFragment;
  /**
   * Whether `meta` comes back as an object instead of a single-element array — the fixed
   * `{$set: {meta: {$ifNull: [{$arrayElemAt: ["$meta", 0]}, …]}}}` idiom two controllers use. The idiom is
   * recognized rather than compiled; anything else raises.
   */
  flattenMeta: boolean;
}

export interface RowsPlan {
  kind: "rows";
  statement: SqlFragment;
}

export type AggregatePlan = RowsPlan | FacetPlan;

export function compileAggregate(pipeline: object[], context: AggregateContext): AggregatePlan {
  const wholeCollection = compileWholeCollectionGroup(pipeline || [], context);
  if (wholeCollection) return wholeCollection;

  const {before, resolutions, after} = splitAtLookups(pipeline || []);
  const stages = resolutions.length ? after : before;
  const facetIndex = stages.findIndex(stage => "$facet" in (stage as any));

  if (resolutions.length && facetIndex !== -1) {
    // Never used together; supporting it would mean an inner query and parameter array per facet branch.
    throw new UnsupportedExpressionError("$facet together with a relation lookup", "postgres");
  }

  if (!resolutions.length) {
    if (facetIndex === -1) {
      return {kind: "rows", statement: new AggregateState(context).compile(stages)};
    }
    return compileFacet(stages, facetIndex, context, context.qualified);
  }

  /**
   * A pipeline with a join has **two layers**: the base table with the stages before `$lookup` inside, the
   * joins and what follows them outside. The split point comes from the pipeline, so a join placed before
   * `$match` filters the resolved value while one placed after pagination only joins the paginated rows.
   *
   * Both layers share **one** state: the parameter numbers have to stay continuous.
   */
  const state = new AggregateState(context);
  const inner = state.compile(before);
  const source = lookupSource(resolutions, context, `(\n${indent(inner.sql)}\n)`);
  return {kind: "rows", statement: state.compile(after, source)};
}

/**
 * `$group` over the **whole collection**: a constant `_id` with one or more `$sum`s, which is the only shape
 * the codebase uses. Grouping by a field is `ReadPlan`'s job and anything outside this shape raises.
 *
 * Two Mongo semantics have to be reproduced, and neither is SQL's default:
 *
 * - **An empty input produces no row** — `sum()` would return one NULL row, and every caller reads
 *   `d.length ? d[0].total : 0`, so that row would turn `0` into `null`. Hence `HAVING count(*) > 0`.
 * - **`$sum` treats a missing field as 0**, while `sum()` over all-NULL is NULL. Hence the `COALESCE`.
 */
function compileWholeCollectionGroup(
  pipeline: object[],
  context: AggregateContext
): RowsPlan | undefined {
  const groupIndex = pipeline.findIndex(stage => "$group" in (stage as any));
  if (groupIndex === -1) return undefined;

  const group = (pipeline[groupIndex] as any).$group;
  const sums = constantGroupSums(group, context.table);
  if (!sums) return undefined;

  const head = pipeline.slice(0, groupIndex);
  const tail = pipeline.slice(groupIndex + 1);

  // Only `$match` before and `$project` after: anything else changes what the group sees or returns.
  if (head.some(stage => !("$match" in (stage as any)))) return undefined;
  if (tail.some(stage => !("$project" in (stage as any)))) return undefined;

  const params: unknown[] = [];
  let where = "";
  for (const stage of head) {
    const fragment = compileCrudFilter((stage as any).$match, {
      table: context.table,
      paramOffset: params.length
    });
    params.push(...fragment.params);
    where = where ? `(${where}) AND (${fragment.sql})` : fragment.sql;
  }

  // A trailing `$project` may only narrow the accumulators; including anything else is a different pipeline.
  const projected = tail.length ? Object.keys((tail[tail.length - 1] as any).$project) : undefined;
  if (
    projected &&
    projected.some(name => name !== "_id" && !sums.some(sum => sum.alias === name))
  ) {
    return undefined;
  }

  const wanted = projected ? sums.filter(sum => projected.includes(sum.alias)) : sums;

  const columns = [
    `${group._id === null ? "NULL" : "''"} AS "_id"`,
    ...wanted.map(sum => `${sum.expression} AS "${sum.alias}"`)
  ];

  const sql = [
    `SELECT ${columns.join(", ")}`,
    `FROM ${context.qualified}`,
    where ? `WHERE ${where}` : "",
    // Mongo's `$group` emits nothing for an empty input; SQL's aggregate would emit one NULL row.
    `HAVING count(*) > 0`
  ]
    .filter(Boolean)
    .join("\n");

  return {kind: "rows", statement: {sql, params}};
}

/**
 * Is this a group by a constant with `$sum` accumulators only? Returns their SQL, or `undefined` so the
 * caller can fall through to the general path (which then raises for an unsupported `$group`).
 */
function constantGroupSums(
  group: any,
  table: TableSpec
): {alias: string; expression: string}[] | undefined {
  if (!group || typeof group !== "object") return undefined;
  // A field reference as `_id` means grouping **by a field**, which is not this shape.
  if (typeof group._id === "string" && group._id.startsWith("$")) return undefined;
  if (group._id !== null && group._id !== "") return undefined;

  const sums: {alias: string; expression: string}[] = [];
  for (const [alias, accumulator] of Object.entries(group)) {
    if (alias === "_id") continue;
    const sum = (accumulator as any)?.$sum;
    if (sum === undefined) return undefined;
    if (typeof sum === "number") {
      // `{$sum: 1}` counts the documents.
      sums.push({
        alias,
        expression: sum === 1 ? "count(*)::double precision" : `(count(*) * ${sum})`
      });
      continue;
    }
    sums.push({alias, expression: `COALESCE(sum(${numericPath(fieldRef(sum), table)}), 0)`});
  }
  return sums.length ? sums : undefined;
}

/**
 * A `$sum`'s field path → a numeric SQL expression. A dotted path reaches into a `json` column and `->>`
 * gives text, so the cast is explicit.
 *
 * **`double precision`, not `numeric`:** `pg` hands `numeric` back as a **string** to keep its arbitrary
 * precision, and the callers do arithmetic on the result — `9000000 + 1000000` became
 * `"90000001000000"`. `float8` parses as a number and is exact for byte counts.
 */
function numericPath(path: string, table: TableSpec): string {
  const [root, ...rest] = path.split(".");
  const kind = table.columns.find(column => column.name === root)?.kind;

  if (!rest.length) {
    if (kind !== "number") {
      throw new UnsupportedExpressionError(
        `$sum over '${root}' whose column kind is '${kind}'`,
        "postgres"
      );
    }
    return `"${root}"`;
  }

  if (kind !== "json") {
    throw new UnsupportedExpressionError(
      `$sum over the path '${path}' whose root column kind is '${kind}'`,
      "postgres"
    );
  }

  const steps = rest.map((step, index) =>
    index === rest.length - 1 ? `->>'${step}'` : `->'${step}'`
  );
  return `("${root}"${steps.join("")})::double precision`;
}

function compileFacet(
  stages: object[],
  facetIndex: number,
  context: AggregateContext,
  source: string
): FacetPlan {
  /**
   * `$facet` splits the pipeline in two: the stages before it are applied to **both** (Mongo's
   * semantics), then the `meta` and `data` sub-pipelines are compiled separately.
   */
  const tail = stages.slice(facetIndex + 1);
  const flattenMeta = tail.length === 1 && isMetaFlattenStage(tail[0]);

  if (tail.length && !flattenMeta) {
    throw new UnsupportedExpressionError(
      `aggregation stages after $facet: ${JSON.stringify(tail)}`,
      "postgres"
    );
  }

  const prefix = stages.slice(0, facetIndex);
  const facet = (stages[facetIndex] as any).$facet;
  const keys = Object.keys(facet);

  if (keys.length !== 2 || !facet.meta || !facet.data) {
    throw new UnsupportedExpressionError(
      `$facet shape ${JSON.stringify(keys)} (only {meta, data} is supported)`,
      "postgres"
    );
  }

  const metaStages = facet.meta as object[];
  if (metaStages.length !== 1 || !("$count" in (metaStages[0] as any))) {
    throw new UnsupportedExpressionError(
      "$facet.meta (only [{$count: '...'}] is supported)",
      "postgres"
    );
  }

  return {
    kind: "facet",
    metaField: (metaStages[0] as any).$count,
    flattenMeta,
    data: new AggregateState(context).compile([...prefix, ...(facet.data as object[])], source),
    count: new AggregateState(context).compile([...prefix, ...metaStages], source)
  };
}

class AggregateState {
  private params: unknown[] = [];

  constructor(private context: AggregateContext) {}

  compile(pipeline: object[], source: string = this.context.qualified): SqlFragment {
    let where = "";
    let orderBy = "";
    let limit = "";
    let offset = "";
    let select = "*";
    let count = false;

    for (const stage of pipeline) {
      const keys = Object.keys(stage);
      if (keys.length !== 1) {
        throw new UnsupportedExpressionError(
          `aggregation stage ${JSON.stringify(stage)}`,
          "postgres"
        );
      }

      const [name] = keys;
      if (!SUPPORTED.has(name)) {
        throw new UnsupportedExpressionError(
          `aggregation stage '${name}' (use read() for relations, grouping and i18n)`,
          "postgres"
        );
      }

      const operand = (stage as any)[name];

      switch (name) {
        case "$match": {
          /**
           * Consecutive `$match` stages are combined with `AND`. That is what they mean in Mongo too;
           * producing a separate `WHERE` and losing the later one would be a silent data difference.
           */
          const fragment = compileCrudFilter(operand, {
            table: this.context.table,
            paramOffset: this.params.length
          });
          this.params.push(...fragment.params);
          where = where ? `(${where}) AND (${fragment.sql})` : fragment.sql;
          break;
        }

        case "$sort":
          orderBy = this.sort(operand);
          break;

        case "$skip":
          offset = `OFFSET ${this.bind(operand)}`;
          break;

        case "$limit":
          limit = `LIMIT ${this.bind(operand)}`;
          break;

        case "$project":
          select = this.project(operand);
          break;

        case "$count":
          count = true;
          // `$count` changes the result shape: one row, one field.
          select = `count(*)::int AS "${operand}"`;
          break;
      }
    }

    const parts = [
      `SELECT ${select}`,
      `FROM ${source}`,
      where ? `WHERE ${where}` : "",
      // Sorting and pagination are meaningless because `$count` aggregates.
      count ? "" : orderBy,
      count ? "" : limit,
      count ? "" : offset
    ].filter(Boolean);

    return {sql: parts.join("\n"), params: this.params};
  }

  private sort(operand: Record<string, 1 | -1>): string {
    const pieces = Object.entries(operand).map(([field, direction]) => {
      this.assertColumn(field);
      return `"${field}" ${direction === -1 ? "DESC" : "ASC"}`;
    });
    return pieces.length ? `ORDER BY ${pieces.join(", ")}` : "";
  }

  /**
   * `{field: 0}` is exclusion, `{field: 1}` inclusion. Mongo does not allow the two to be mixed (`_id`
   * aside) and neither do we — the meaning of a mixed projection is undefined.
   */
  private project(operand: Record<string, any>): string {
    const entries = Object.entries(operand).filter(([field]) => field !== "_id");
    const includes: string[] = [];
    const excludes: string[] = [];
    const computed: [string, any][] = [];

    for (const [field, value] of entries) {
      if (value === 1 || value === true) includes.push(field);
      else if (value === 0 || value === false) excludes.push(field);
      else if (value && typeof value === "object") computed.push([field, value]);
      else {
        /**
         * **An unrecognized value must not stay silent**: ignoring everything other than 0/1 puts a
         * computed projection on the exclusion branch, which returns every column instead.
         */
        throw new UnsupportedExpressionError(
          `$project value ${JSON.stringify(value)} for '${field}'`,
          "postgres"
        );
      }
    }

    if (computed.length) {
      if (excludes.length) {
        throw new UnsupportedExpressionError(
          "$project mixing computed fields with exclusion",
          "postgres"
        );
      }

      // Mongo returns `_id` by default when there are computed fields.
      const pieces = ['"_id"'];
      for (const field of includes) {
        this.assertColumn(field);
        pieces.push(`"${field}"`);
      }
      for (const [field, expression] of computed) {
        pieces.push(`${this.computedProjection(expression)} AS "${field}"`);
      }
      return pieces.join(", ");
    }

    if (includes.length && excludes.length) {
      throw new UnsupportedExpressionError(
        `mixed $project (both inclusion and exclusion)`,
        "postgres"
      );
    }

    const all = this.context.table.columns.map(c => c.name);

    if (includes.length) {
      for (const field of includes) this.assertColumn(field);
      return ['"_id"', ...includes.map(f => `"${f}"`)].join(", ");
    }

    /**
     * Exclusion comes in two forms: a plain column, and a **nested json path** such as
     * `"authFactor.secret": 0`, where dropping the whole column would take more than the hidden secret.
     */
    const droppedColumns = new Set<string>();
    const rewritten = new Map<string, string>();

    for (const field of excludes) {
      const [root, ...rest] = field.split(".");
      if (!rest.length) {
        this.assertColumn(root);
        droppedColumns.add(root);
        continue;
      }

      const kind = this.context.table.columns.find(c => c.name === root)?.kind;
      if (kind !== "json") {
        throw new UnsupportedExpressionError(
          `$project exclusion of nested path '${field}' where '${root}' is '${kind}', not json`,
          "postgres"
        );
      }

      const path = rest.join(",");
      const base = rewritten.get(root) || `"${root}"`;
      rewritten.set(root, `(${base} #- '{${path}}')`);
    }

    const pieces = ['"_id"'];
    for (const name of all) {
      if (droppedColumns.has(name)) continue;
      const expression = rewritten.get(name);
      pieces.push(expression ? `${expression} AS "${name}"` : `"${name}"`);
    }
    return pieces.join(", ");
  }

  /** The computed expressions inside `$project` — a finite set; anything unrecognized raises. */
  private computedProjection(expression: any): string {
    if (expression.$size !== undefined) {
      const field = fieldRef(expression.$size);
      const kind = this.context.table.columns.find(column => column.name === field)?.kind;

      if (kind === "json") return `COALESCE(jsonb_array_length("${field}"), 0)`;
      if (kind === "textArray" || kind === "numberArray") {
        return `COALESCE(array_length("${field}", 1), 0)`;
      }

      throw new UnsupportedExpressionError(
        `$size on '${field}' whose column kind is '${kind}'`,
        "postgres"
      );
    }

    const toDate =
      expression.$toDate !== undefined
        ? expression.$toDate
        : expression.$convert?.to === "date"
          ? expression.$convert.input
          : undefined;

    if (toDate !== undefined) {
      const field = fieldRef(toDate);
      if (field !== "_id") {
        throw new UnsupportedExpressionError(
          `date conversion of '${field}' (only '_id' carries a timestamp)`,
          "postgres"
        );
      }

      /**
       * The first 4 bytes of an `ObjectId` are a unix timestamp and `_id` is stored as `char(24)` hex,
       * so the first 8 characters. `'x' || …` converts hex to `bit(32)`.
       */
      return `to_timestamp(('x' || substring("_id", 1, 8))::bit(32)::int)`;
    }

    throw new UnsupportedExpressionError(
      `computed $project expression ${JSON.stringify(expression)}`,
      "postgres"
    );
  }

  /**
   * An unknown field **raises** rather than being silently skipped: a field that disappears in
   * `ORDER BY` or `$project` means a result set different from the one the caller expects.
   */
  private assertColumn(field: string): void {
    if (field === "_id") return;
    const known = this.context.table.columns.some(c => c.name === field);
    if (!known) {
      throw new UnsupportedExpressionError(
        `'${field}' is not a property of this collection`,
        "postgres"
      );
    }
  }

  private bind(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

/**
 * Recognizes the `{$set: {meta: {$ifNull: [{$arrayElemAt: ["$meta", 0]}, …]}}}` idiom **structurally**: the
 * two callers write the default value differently and both mean the same thing.
 */
function isMetaFlattenStage(stage: any): boolean {
  const set = stage?.$set;
  if (!set || Object.keys(stage).length !== 1 || Object.keys(set).length !== 1) return false;

  const ifNull = set.meta?.$ifNull;
  if (!Array.isArray(ifNull) || ifNull.length !== 2) return false;

  const elemAt = ifNull[0]?.$arrayElemAt;
  return Array.isArray(elemAt) && elemAt[0] === "$meta" && elemAt[1] === 0;
}

/**
 * The relation resolution triple: `$lookup` + `$unwind` + `$set`, recognized structurally rather than
 * compiled generally. The foreign field has to be `_id`, so the join's target is a single row.
 */
interface LookupResolution {
  /** The output field — **also** the column that carries the id. That is how it is in both callers. */
  out: string;
  target: string;
  field: string;
  /** Whether the original value is kept when there is no match (the `$ifNull` fallback). */
  fallback: boolean;
}

/**
 * Splits the pipeline at the `$lookup` group. Two shapes are recognized and both do the same job — replace
 * a field carrying an id with a field of the target document:
 *
 * ```
 * activity:      $lookup(as = localField) → $unwind → $set{f: "$f.x"}
 * function/log:  $set{tmp: {$toObjectId: "$f"}} → $lookup(as = "fn", localField = tmp)
 *                → $unwind → $set{f: {$ifNull: ["$fn.x", "$f"]}} → $unset[tmp, "fn"]
 * ```
 *
 * The second shape's temporaries never materialize: `$toObjectId` is meaningless here because the column
 * is already text, and the join binds to the source column, which makes `$unset` a no-op.
 */
function splitAtLookups(stages: object[]): {
  before: object[];
  resolutions: LookupResolution[];
  after: object[];
} {
  const first = stages.findIndex((_, index) => startsLookupGroup(stages, index));

  if (first === -1) {
    assertNoJoinStage(stages);
    return {before: stages, resolutions: [], after: []};
  }

  const before = stages.slice(0, first);
  assertNoJoinStage(before);

  const resolutions: LookupResolution[] = [];
  let index = first;
  while (index < stages.length && startsLookupGroup(stages, index)) {
    const group = recognizeLookupGroup(stages, index);
    resolutions.push(group.resolution);
    index = group.next;
  }

  const after = stages.slice(index);
  assertNoJoinStage(after);

  return {before, resolutions, after};
}

function assertNoJoinStage(stages: object[]): void {
  const stray = stages.find(stage => "$lookup" in (stage as any) || "$unwind" in (stage as any));
  if (stray) {
    throw new UnsupportedExpressionError(
      `${Object.keys(stray)[0]} outside the recognized relation-resolution shape`,
      "postgres"
    );
  }
}

function startsLookupGroup(stages: object[], index: number): boolean {
  const stage = stages[index] as any;
  if (!stage) return false;
  if ("$lookup" in stage) return true;
  // A `$set` that defines a temporary field is part of the group only when a `$lookup` follows it immediately.
  return Boolean(tempFields(stage)) && "$lookup" in ((stages[index + 1] as any) || {});
}

/** `{$set: {tmp: {$toObjectId: "$field"}}}` → `{tmp: "field"}`; `undefined` when it is not recognized. */
function tempFields(stage: any): Record<string, string> | undefined {
  const set = stage?.$set;
  if (!set || Object.keys(stage).length !== 1) return undefined;

  const temps: Record<string, string> = {};
  for (const [name, expression] of Object.entries<any>(set)) {
    const inner =
      expression?.$toObjectId ??
      expression?.$toString ??
      (typeof expression === "string" ? expression : undefined);
    if (typeof inner !== "string" || !inner.startsWith("$")) return undefined;
    temps[name] = inner.slice(1);
  }
  return temps;
}

function recognizeLookupGroup(
  stages: object[],
  index: number
): {resolution: LookupResolution; next: number} {
  const reject = (detail: string) => {
    throw new UnsupportedExpressionError(
      `$lookup ${detail}; got ${JSON.stringify(stages.slice(index, index + 5))}`,
      "postgres"
    );
  };

  let cursor = index;
  const temps = "$lookup" in (stages[cursor] as any) ? {} : tempFields(stages[cursor])!;
  if (Object.keys(temps).length) cursor++;

  const lookup = (stages[cursor] as any).$lookup;
  if (lookup?.foreignField !== "_id") reject("must join on the target's '_id'");
  if (!lookup.from || !lookup.localField || !lookup.as) reject("needs from, localField and as");

  const source = temps[lookup.localField] ?? lookup.localField;
  const alias = lookup.as;
  cursor++;

  const unwind = (stages[cursor] as any)?.$unwind;
  if (!unwind || unwind.path !== `$${alias}` || unwind.preserveNullAndEmptyArrays !== true) {
    reject("must be followed by $unwind with preserveNullAndEmptyArrays");
  }
  cursor++;

  const set = (stages[cursor] as any)?.$set;
  if (!set || Object.keys(set).length !== 1) reject("must be followed by a single-field $set");

  const [out] = Object.keys(set);
  const {field, fallback} = readFlattenExpression(set[out], alias, out, reject);
  cursor++;

  /**
   * `$unset` may only remove temporary fields. If it removes a real column the shape is not the one we
   * recognize, and staying silent would be a data difference.
   */
  const unset = (stages[cursor] as any)?.$unset;
  if (unset) {
    const names = Array.isArray(unset) ? unset : Object.keys(unset);
    const allowed = new Set([...Object.keys(temps), alias]);
    if (!names.every(name => allowed.has(name)))
      reject("$unset may only drop the group's temporaries");
    cursor++;
  }

  // The output field has to be the source column itself, or the codec decodes the row with the wrong type.
  if (out !== source) reject(`writes '${out}' but reads '${source}'`);

  return {resolution: {out, target: lookup.from, field, fallback}, next: cursor};
}

function readFlattenExpression(
  expression: any,
  alias: string,
  out: string,
  reject: (detail: string) => void
): {field: string; fallback: boolean} {
  const prefix = `$${alias}.`;

  const direct = (value: any): string | undefined =>
    typeof value === "string" && value.startsWith(prefix) && value !== prefix
      ? value.slice(prefix.length)
      : undefined;

  const plain = direct(expression);
  if (plain) return {field: plain, fallback: false};

  // `{$ifNull: ["$alias.field", "$out"]}` — the original value is kept when there is no match.
  const ifNull = expression?.$ifNull;
  if (Array.isArray(ifNull) && ifNull.length === 2 && ifNull[1] === `$${out}`) {
    const field = direct(ifNull[0]);
    if (field) return {field, fallback: true};
  }

  reject("must flatten the joined document to one of its fields");
  throw new Error("unreachable");
}

/**
 * The resolved source: a derived table with a join. Without a match the `LEFT JOIN` gives `NULL`, which the
 * codec omits as a field — Mongo drops it the same way — and with a fallback `COALESCE` restores the
 * original value.
 */
function lookupSource(
  resolutions: LookupResolution[],
  context: AggregateContext,
  from: string
): string {
  const resolved = new Map(resolutions.map(resolution => [resolution.out, resolution]));
  const kinds = new Map(context.table.columns.map(column => [column.name, column.kind]));

  for (const resolution of resolutions) {
    if (!kinds.has(resolution.out)) {
      throw new UnsupportedExpressionError(
        `$lookup writes into '${resolution.out}', which is not a property of this collection`,
        "postgres"
      );
    }
  }

  const columns = ['a."_id"'];
  for (const column of context.table.columns) {
    const resolution = resolved.get(column.name);
    if (!resolution) {
      columns.push(`a."${column.name}"`);
      continue;
    }
    const value = `${joinAlias(column.name)}.value`;
    columns.push(
      resolution.fallback
        ? `COALESCE(${value}, a."${column.name}") AS "${column.name}"`
        : `${value} AS "${column.name}"`
    );
  }

  const joins = resolutions.map(resolution => {
    const target = context.resolveTarget?.(resolution.target);
    if (!target) {
      throw new UnsupportedExpressionError(
        `$lookup target '${resolution.target}' is unknown to this driver`,
        "postgres"
      );
    }

    const targetKind = target.columns.find(column => column.name === resolution.field)?.kind;
    if (!targetKind) {
      throw new UnsupportedExpressionError(
        `$lookup takes '${resolution.field}' from '${resolution.target}', which has no such property`,
        "postgres"
      );
    }

    /**
     * A type match is **mandatory**: the resolved value comes back under the local column's name, so a
     * mismatch means the codec decodes the row wrongly and silently.
     */
    if (targetKind !== kinds.get(resolution.out)) {
      throw new UnsupportedExpressionError(
        `$lookup puts '${resolution.target}.${resolution.field}' (${targetKind}) into ` +
          `'${resolution.out}' (${kinds.get(resolution.out)})`,
        "postgres"
      );
    }

    const alias = joinAlias(resolution.out);
    const t = `${alias}_t`;
    return (
      `LEFT JOIN LATERAL (\n` +
      `    SELECT ${t}."${resolution.field}" AS value\n` +
      `    FROM ${qualify(target)} ${t}\n` +
      `    WHERE ${t}."_id" = a."${resolution.out}"\n` +
      `    LIMIT 1\n` +
      `  ) ${alias} ON true`
    );
  });

  return `(\n  SELECT ${columns.join(", ")}\n  FROM ${from} a\n  ${joins.join("\n  ")}\n) resolved`;
}

const indent = (sql: string) =>
  sql
    .split("\n")
    .map(line => `  ${line}`)
    .join("\n");

const joinAlias = (path: string) => `l_${path}`;
const qualify = (table: TableSpec) => `${table.namespace || BUCKET_SCHEMA}."${table.collection}"`;

/** `"$field"` → `field`; an expression that is not a field reference is rejected. */
function fieldRef(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("$") || value.length < 2) {
    throw new UnsupportedExpressionError(
      `expected a field reference, got ${JSON.stringify(value)}`,
      "postgres"
    );
  }
  return value.slice(1);
}
