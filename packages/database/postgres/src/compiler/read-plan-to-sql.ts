import {
  Expression,
  ReadPlan,
  RelationResolution,
  SortSpec,
  TableSpec,
  UnsupportedExpressionError
} from "@spica-server/database-driver";
import {compileExpression, SqlFragment} from "./expression-to-sql.js";
import {BUCKET_SCHEMA} from "../schema/naming.js";

/**
 * ReadPlan → SQL. The plan says **what** is wanted; **how** is decided here, and two of those decisions were
 * measured:
 *
 * 1. **Stage placement.** `stage: "projection"` relations are resolved after the base query has been
 *    `LIMIT`ed (a subquery plus an outer `LATERAL`); `"filter"` ones are joined before the `WHERE`. The
 *    difference is two orders of magnitude. Localization needs no such structure — a `COALESCE` in the SELECT
 *    list is already evaluated on the returned rows only.
 * 2. **Pagination is two statements**, run in parallel by the driver: `count(*) OVER ()` has to materialize
 *    every matching row and measured 38% slower.
 */
export interface ReadStatement {
  data: SqlFragment;
  /** Filled when `paginate: true`. The driver runs it **in parallel** with `data`. */
  count?: SqlFragment;
}

export interface ReadCompileContext {
  /** The table definition of the bucket being read. */
  table: TableSpec;
  /** The table definitions of the relation targets — `to_jsonb` needs the column list. */
  targets?: Record<string, TableSpec>;
  auth?: Record<string, any>;
}

const BASE = "b";

/** The relations declared to the compiler: path → the join alias and the target table definition. */
type RelationContext = Record<string, {alias: string; table: TableSpec}>;

export function compileReadPlan(plan: ReadPlan, context: ReadCompileContext): ReadStatement {
  const builder = new ReadBuilder(plan, context);
  return {data: builder.data(), count: plan.paginate ? builder.count() : undefined};
}

class ReadBuilder {
  private params: unknown[] = [];

  constructor(
    private plan: ReadPlan,
    private context: ReadCompileContext
  ) {}

  data(): SqlFragment {
    this.params = [];

    const filterRelations = (this.plan.relations || []).filter(r => r.stage === "filter");
    const projectionRelations = (this.plan.relations || []).filter(r => r.stage === "projection");
    const where = this.where();

    // One layer is enough when there is no relation to display.
    if (!projectionRelations.length) {
      const sql = [
        `SELECT ${this.selectList(BASE, filterRelations)}`,
        `FROM ${qualified(this.plan.collection)} ${BASE}`,
        ...this.relationJoins(filterRelations, BASE),
        where ? `WHERE ${where}` : "",
        this.orderBy(BASE),
        this.limitOffset()
      ]
        .filter(Boolean)
        .join("\n");
      return {sql, params: this.params};
    }

    /**
     * `stage: "projection"` relations are resolved **after** the `LIMIT`: the base query moves into a
     * subquery and the join stays outside.
     *
     * The inner layer lists its columns explicitly rather than using `b.*`, because the outer layer produces
     * a resolved relation under the same name and the two collide as `column reference is ambiguous`.
     */
    const inner = [
      `SELECT ${this.innerColumns(BASE, projectionRelations, filterRelations)}`,
      `FROM ${qualified(this.plan.collection)} ${BASE}`,
      ...this.relationJoins(filterRelations, BASE),
      where ? `WHERE ${where}` : "",
      this.orderBy(BASE),
      this.limitOffset()
    ]
      .filter(Boolean)
      .join("\n");

    const sql = [
      `SELECT ${this.selectList(BASE, projectionRelations, filterRelations)}`,
      `FROM (\n${indent(inner)}\n) ${BASE}`,
      ...this.relationJoins(projectionRelations, BASE)
    ].join("\n");

    return {sql, params: this.params};
  }

  /**
   * The inner layer's columns: the raw column (the id) of the relation to be resolved is carried because
   * the join needs it, but it is named so that the alias in the outer layer does not shadow it.
   */
  private innerColumns(
    alias: string,
    projectionRelations: RelationResolution[],
    filterRelations: RelationResolution[] = []
  ): string {
    const shadowed = new Set(projectionRelations.map(r => r.path));
    const carried = new Set(filterRelations.map(r => r.path));
    const pieces = [`${alias}."_id"`];
    for (const column of this.context.table.columns) {
      if (shadowed.has(column.name)) {
        // The id the join needs; in the outer layer the relation's value will take this name.
        pieces.push(`${alias}."${column.name}" AS "${column.name}__id"`);
        continue;
      }
      /**
       * A relation resolved at the filter stage already has its value in the inner layer and has to be carried
       * out, or the outer `SELECT` takes the raw id column and the relation silently falls back to the id.
       */
      if (carried.has(column.name)) continue;
      pieces.push(`${alias}."${column.name}"`);
    }
    for (const relation of filterRelations) {
      pieces.push(`${relationAlias(relation)}.value AS "${relation.path}"`);
    }
    return pieces.join(", ");
  }

  /** The count query: no `sort`/`skip`/`limit`, only the filter and the relations it needs. */
  count(): SqlFragment {
    this.params = [];
    const filterRelations = (this.plan.relations || []).filter(r => r.stage === "filter");
    const where = this.where();
    const sql = [
      `SELECT count(*)::int AS total`,
      `FROM ${qualified(this.plan.collection)} ${BASE}`,
      ...this.relationJoins(filterRelations, BASE),
      where ? `WHERE ${where}` : ""
    ]
      .filter(Boolean)
      .join("\n");
    return {sql, params: this.params};
  }

  // ── WHERE: the ACL and the user's filter
  private where(): string {
    const parts: string[] = [];

    // The filter can reference a joined relation's field, whose value is in the join's output.
    const relations = this.relationContext(
      (this.plan.relations || []).filter(relation => relation.stage === "filter")
    );

    for (const expression of [this.plan.acl, this.plan.filter]) {
      if (!expression) continue;
      parts.push(this.condition(expression, BASE, relations));
    }
    return parts.join(" AND ");
  }

  /**
   * The relations whose target table is known → the compiler's alias map. **The children are declared too**,
   * because a filter can go two levels deep and the compiler has to know which level is an array. They get no
   * alias: their join lives inside the parent's lateral and is not visible from outside.
   */
  private relationContext(relations: RelationResolution[]): RelationContext {
    const entries = relations
      .filter(relation => this.context.targets?.[relation.target])
      .map(relation => {
        const table = this.context.targets![relation.target];
        return [
          relation.path,
          {
            alias: relationAlias(relation),
            table,
            // The value of a `many` relation is an array; the filter is compiled as "any element".
            many: relation.type === "many",
            children: relation.children?.length
              ? this.relationContext(relation.children)
              : undefined
          }
        ] as const;
      });
    return Object.fromEntries(entries);
  }

  /**
   * Compiles a CEL condition and accumulates its parameters. The `WHERE` and field-level ACL's `CASE WHEN` go
   * through the **same** place, so the `auth` resolution, the locale and the relation context are identical.
   */
  private condition(expr: Expression, alias: string, relations: RelationContext): string {
    const fragment = compileExpression(expr, {
      relations,
      table: this.context.table,
      locale: this.plan.localize
        ? {best: this.plan.localize.locale, fallback: this.plan.localize.fallback}
        : undefined,
      alias,
      auth: this.plan.auth ?? this.context.auth,
      paramOffset: this.params.length
    });
    this.params.push(...fragment.params);
    return fragment.sql;
  }

  // ── The SELECT list: localization plus projection
  private selectList(
    alias: string,
    relations: RelationResolution[],
    carriedRelations: RelationResolution[] = []
  ): string {
    const localize = this.plan.localize;
    const projection = this.plan.projection;
    const denied = new Set(projection?.denied || []);
    const include = projection?.include?.length ? new Set(projection.include) : undefined;
    const exclude = new Set(projection?.exclude || []);
    const conditional = new Map(
      (projection?.conditional || []).map(entry => [entry.path, entry.when])
    );
    const relationContext = this.relationContext(relations);

    /**
     * Field-level ACL turns the column into `NULL` when the condition is false, and the codec reads a `NULL`
     * column as an **absent** field — the same document Mongo's `$$REMOVE` produces. A marker such as
     * `'null'::jsonb` would make the field present but empty.
     */
    const project = (name: string, reference: string, aliased: boolean): string => {
      const when = conditional.get(name);
      if (!when) {
        return aliased ? `${reference} AS "${name}"` : reference;
      }
      return `CASE WHEN ${this.condition(when, alias, relationContext)} THEN ${reference} ELSE NULL END AS "${name}"`;
    };

    const pieces: string[] = [`${alias}."_id"`];

    const resolved = new Set(relations.map(r => r.path));
    // Resolved in the inner layer: selected like plain columns, because `innerColumns` carried the value.
    for (const relation of carriedRelations) {
      resolved.add(relation.path);
      if (denied.has(relation.path) || exclude.has(relation.path)) continue;
      if (include && !include.has(relation.path)) continue;
      pieces.push(project(relation.path, `${alias}."${relation.path}"`, false));
    }
    for (const column of this.context.table.columns) {
      // When a relation is resolved the raw id column is not returned; the resolved document takes its place.
      if (resolved.has(column.name)) continue;
      if (denied.has(column.name) || exclude.has(column.name)) continue;
      if (include && !include.has(column.name)) continue;

      if (column.translated) {
        if (!localize) {
          // When localization is not requested the language map is returned raw (the behaviour on Mongo).
          pieces.push(project(column.name, `${alias}."${column.name}"`, false));
          continue;
        }
        const best = this.bind(localize.locale);
        const fallback = this.bind(localize.fallback);
        pieces.push(
          project(
            column.name,
            `COALESCE(${alias}."${column.name}"->>${best}, ${alias}."${column.name}"->>${fallback})`,
            true
          )
        );
        continue;
      }

      pieces.push(project(column.name, `${alias}."${column.name}"`, false));
    }

    // A resolved relation's value comes from the join alias.
    for (const relation of relations) {
      if (denied.has(relation.path) || exclude.has(relation.path)) continue;
      if (include && !include.has(relation.path)) continue;
      pieces.push(project(relation.path, `${relationAlias(relation)}.value`, true));
    }

    return pieces.join(", ");
  }

  // ── Relation resolution
  private relationColumns(relations: RelationResolution[], alias: string): string {
    if (!relations.length) return "";
    return (
      ", " +
      relations.map(relation => `${relationAlias(relation)}.value AS "${relation.path}"`).join(", ")
    );
  }

  private relationJoins(relations: RelationResolution[], alias: string): string[] {
    return relations.map(relation => this.relationJoin(relation, alias, this.context.table, ""));
  }

  /**
   * A relation's `LATERAL` join, which can be **nested**: a child's join is bound to the target row inside the
   * same lateral and merged with `to_jsonb(target) || jsonb_build_object(…)`, so depth stays within one query.
   *
   * `owner` is the **target's** definition, because a `onetomany`'s junction table lives on the relation's
   * owner, which in the nested case is the level above rather than the base table. `prefix` keeps aliases from
   * colliding across levels.
   */
  private relationJoin(
    relation: RelationResolution,
    alias: string,
    owner: TableSpec,
    prefix: string
  ): string {
    const target = this.context.targets?.[relation.target];
    if (!target) {
      throw new UnsupportedExpressionError(
        `relation '${relation.path}' target table '${relation.target}' is unknown`,
        "postgres"
      );
    }

    const ra = prefixedAlias(prefix, relation.path);
    const t = `${ra}_t`;
    const childPrefix = prefix ? `${prefix}_${relation.path}` : relation.path;

    const children = relation.children || [];
    const childJoins = children.map(child => this.relationJoin(child, t, target, childPrefix));
    const value = mergedValue(t, children, childPrefix);
    const childSql = childJoins.length ? `  ${childJoins.join("\n  ")}\n` : "";

    if (relation.type === "one") {
      // The inner layer renamed the column to `<path>__id`, but only at the top level.
      const idColumn =
        !prefix && relation.stage === "projection" ? `${relation.path}__id` : relation.path;
      return (
        `LEFT JOIN LATERAL (\n` +
        `  SELECT ${value} AS value\n` +
        `  FROM ${qualified(relation.target)} ${t}\n` +
        childSql +
        `  WHERE ${t}."_id" = ${alias}."${idColumn}"\n` +
        `) ${ra} ON true`
      );
    }

    /**
     * onetomany: the id array is expanded with `unnest … WITH ORDINALITY`, which preserves the array's **own
     * order**. `COALESCE(…, '[]')` because a requested relation with no match is `[]`, not an absent field —
     * the same as Mongo's `$lookup`.
     */
    const idColumn =
      !prefix && relation.stage === "projection" ? `${relation.path}__id` : relation.path;
    return (
      `LEFT JOIN LATERAL (\n` +
      `  SELECT COALESCE(jsonb_agg(${value} ORDER BY ${ra}_o."ord"), '[]'::jsonb) AS value\n` +
      `  FROM unnest(${alias}."${idColumn}") WITH ORDINALITY AS ${ra}_o(id, ord)\n` +
      `  JOIN ${qualified(relation.target)} ${t} ON ${t}."_id" = ${ra}_o.id\n` +
      childSql +
      `) ${ra} ON true`
    );
  }

  // ── Sorting and pagination
  private orderBy(alias: string): string {
    const sort = this.plan.sort;
    if (!sort || !Object.keys(sort).length) return "";
    const pieces = Object.entries(sort as SortSpec).map(([field, direction]) => {
      const column = this.context.table.columns.find(c => c.name === field);
      if (field !== "_id" && !column) {
        throw new UnsupportedExpressionError(
          `cannot sort by unknown property '${field}'`,
          "postgres"
        );
      }
      const reference =
        column?.translated && this.plan.localize
          ? `COALESCE(${alias}."${field}"->>${this.bind(this.plan.localize.locale)}, ${alias}."${field}"->>${this.bind(this.plan.localize.fallback)})`
          : `${alias}."${field}"`;
      return `${reference} ${direction === -1 ? "DESC" : "ASC"}`;
    });
    return `ORDER BY ${pieces.join(", ")}`;
  }

  private limitOffset(): string {
    const parts: string[] = [];
    if (this.plan.limit !== undefined) parts.push(`LIMIT ${this.bind(this.plan.limit)}`);
    if (this.plan.skip) parts.push(`OFFSET ${this.bind(this.plan.skip)}`);
    return parts.join(" ");
  }

  private bind(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

const relationAlias = (relation: RelationResolution) => prefixedAlias("", relation.path);

/**
 * The join alias. `prefix` prevents collisions across nested levels (`wallet` can exist both at the top and
 * under `user`); dots become underscores because an alias is an identifier.
 */
const prefixedAlias = (prefix: string, path: string) =>
  `r_${(prefix ? `${prefix}_${path}` : path).replace(/\./g, "_")}`;

/**
 * Merges the target row and its resolved children into one `jsonb` value. A `NULL` child is written as `null`,
 * which is what an unmatched relation gives in Mongo too.
 */
/**
 * The jsonb value of a relation target. `to_jsonb(row)` carries columns only, while a document store's target
 * also carries its unresolved `onetomany` fields as raw id arrays, so those are added from the junction table.
 *
 * **The order matters:** the resolved children come last and override a raw id array of the same name.
 */
function mergedValue(t: string, children: RelationResolution[], prefix: string): string {
  /**
   * `jsonb_strip_nulls`, because `to_jsonb(row)` writes a `NULL` column as `null` while a `NULL` column means
   * the field is **absent** — which is how the codec reads it on the base row too.
   */
  const base = `jsonb_strip_nulls(to_jsonb(${t}))`;

  if (!children.length) {
    return base;
  }

  const pairs = children
    .map(child => `jsonb_build_object('${child.path}', ${prefixedAlias(prefix, child.path)}.value)`)
    .join(" || ");

  return `(${base} || ${pairs})`;
}
const qualified = (table: string) => `${BUCKET_SCHEMA}."${table}"`;
const indent = (sql: string) =>
  sql
    .split("\n")
    .map(line => `  ${line}`)
    .join("\n");
