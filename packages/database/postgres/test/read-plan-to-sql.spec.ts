import {describe, expect, it} from "@jest/globals";
import {Expression, ReadPlan, TableSpec} from "@spica-server/database-driver";
import {compileReadPlan} from "@spica-server/database-postgres";

const posts: TableSpec = {
  collection: "bucket_67a1",
  columns: [
    {name: "title", kind: "json", translated: true},
    {name: "slug", kind: "text"},
    {name: "views", kind: "number"},
    {name: "published", kind: "boolean"},
    {name: "created_at", kind: "timestamp"},
    {name: "author", kind: "reference", target: "bucket_67b3"},
    {name: "tags", kind: "textArray"},
    // `onetomany` relation: an id array column (see `bucketToTable`).
    {name: "editors", kind: "textArray", target: "bucket_67b3"}
  ]
};

const authors: TableSpec = {
  collection: "bucket_67b3",
  columns: [{name: "name", kind: "text"}]
};

const ctx = {table: posts, targets: {bucket_67b3: authors}};

const doc = (...path: string[]): Expression =>
  path.reduce<Expression>(
    (left, name) => ({kind: "select", left, right: {kind: "identifier", name}}),
    {kind: "identifier", name: "document"}
  );
const gt = (left: Expression, value: number): Expression => ({
  kind: "binary",
  operator: ">",
  left,
  right: {kind: "literal", type: "double", value}
});

const plan = (overrides: Partial<ReadPlan> = {}): ReadPlan => ({
  collection: "bucket_67a1",
  ...overrides
});

describe("compileReadPlan — basic shape", () => {
  it("uses a schema-qualified table name and an alias", () => {
    const {data} = compileReadPlan(plan(), ctx);
    expect(data.sql).toContain('FROM bucket."bucket_67a1" b');
  });

  it("always selects _id", () => {
    const {data} = compileReadPlan(plan(), ctx);
    expect(data.sql).toContain('b."_id"');
  });

  it("produces no count query unless pagination is asked for", () => {
    expect(compileReadPlan(plan(), ctx).count).toBeUndefined();
  });
});

describe("compileReadPlan — filter and ACL", () => {
  it("the filter reaches WHERE, parameterized", () => {
    const {data} = compileReadPlan(plan({filter: gt(doc("views"), 500)}), ctx);
    expect(data.sql).toContain('WHERE (b."views" > $1)');
    expect(data.params).toEqual([500]);
  });

  it("joins ACL and filter with AND without clashing parameter numbers", () => {
    const {data} = compileReadPlan(
      plan({acl: gt(doc("views"), 10), filter: gt(doc("views"), 500)}),
      ctx
    );
    expect(data.sql).toContain('WHERE (b."views" > $1) AND (b."views" > $2)');
    expect(data.params).toEqual([10, 500]);
  });

  it("compiles ACL into WHERE rather than RLS (K-11)", () => {
    const {data} = compileReadPlan(plan({acl: gt(doc("views"), 1)}), ctx);
    expect(data.sql).not.toContain("POLICY");
    expect(data.sql).toContain("WHERE");
  });
});

describe("compileReadPlan — localization", () => {
  it("resolves a translatable field with COALESCE in the SELECT list", () => {
    const {data} = compileReadPlan(
      plan({
        localize: {locale: "tr_TR", fallback: "en_US", properties: ["title"], stage: "projection"}
      }),
      ctx
    );
    expect(data.sql).toMatch(/COALESCE\(b\."title"->>\$\d+, b\."title"->>\$\d+\) AS "title"/);
    expect(data.params).toEqual(["tr_TR", "en_US"]);
  });

  it("returns the raw language map when localization is not asked for", () => {
    const {data} = compileReadPlan(plan(), ctx);
    expect(data.sql).toContain('b."title"');
    // The language map column is selected raw; `COALESCE` only appears when localization is asked for.
    // (An unresolved `onetomany` field has a `COALESCE` of its own, hence checking the column.)
    expect(data.sql).not.toContain(`COALESCE(b."title"`);
  });
});

describe("compileReadPlan — relation stage placement (§5.1 measurement)", () => {
  it("stage 'filter': the join comes BEFORE WHERE, with no subquery", () => {
    const {data} = compileReadPlan(
      plan({
        relations: [{path: "author", target: "bucket_67b3", type: "one", stage: "filter"}],
        filter: gt(doc("views"), 5)
      }),
      ctx
    );
    const joinAt = data.sql.indexOf("LEFT JOIN LATERAL");
    /**
     * The **outer** `WHERE` is what we look for (the one at line start). An unresolved `onetomany`
     * field's SELECT fragment carries its own `WHERE jr."source" = …`, and a plain `indexOf("WHERE")`
     * found that one — the assertion still held but it measured the wrong thing.
     */
    const whereAt = data.sql.indexOf("\nWHERE");
    expect(joinAt).toBeGreaterThan(-1);
    expect(whereAt).toBeGreaterThan(-1);
    expect(joinAt).toBeLessThan(whereAt);
  });

  it("stage 'projection': the base query is LIMITed into a subquery and the join sits OUTSIDE", () => {
    const {data} = compileReadPlan(
      plan({
        relations: [{path: "author", target: "bucket_67b3", type: "one", stage: "projection"}],
        filter: gt(doc("views"), 5),
        limit: 25
      }),
      ctx
    );
    const limitAt = data.sql.indexOf("LIMIT");
    const joinAt = data.sql.indexOf("LEFT JOIN LATERAL");
    // LIMIT in the inner query, the join after it → resolved only for the rows returned
    expect(limitAt).toBeLessThan(joinAt);
  });

  it("onetoone → a single row via to_jsonb", () => {
    const {data} = compileReadPlan(
      plan({
        relations: [{path: "author", target: "bucket_67b3", type: "one", stage: "projection"}]
      }),
      ctx
    );
    // `jsonb_strip_nulls`: columns that were never written should not appear as `null` in the target document.
    expect(data.sql).toContain("jsonb_strip_nulls(to_jsonb(r_author_t)) AS value");

    /**
     * The inner tier renames the relation's raw id column to `author__id`.
     *
     * A regression guard: the inner tier used to select `b.*`, so the outer tier held both the
     * carried-over `author` (the id) and `r_author.value AS "author"`, and PostgreSQL replied
     * `column reference "author" is ambiguous`.
     */
    expect(data.sql).toContain('r_author_t."_id" = b."author__id"');
    expect(data.sql).toContain('b."author" AS "author__id"');
    expect(data.sql).toContain('r_author.value AS "author"');
    expect(data.sql.match(/AS "author"/g)).toHaveLength(1);
  });

  /** An `onetomany` id array column: `unnest … WITH ORDINALITY` carries the array's own order. */
  it("onetomany → unnest + jsonb_agg, the array ORDER is preserved", () => {
    const {data} = compileReadPlan(
      plan({
        relations: [{path: "editors", target: "bucket_67b3", type: "many", stage: "projection"}]
      }),
      ctx
    );
    expect(data.sql).toContain('unnest(b."editors__id") WITH ORDINALITY AS r_editors_o(id, ord)');
    expect(data.sql).toContain(
      'jsonb_agg(jsonb_strip_nulls(to_jsonb(r_editors_t)) ORDER BY r_editors_o."ord")'
    );
    expect(data.sql).toContain('r_editors_t."_id" = r_editors_o.id');
  });

  it("errors loudly when the target table definition is unknown", () => {
    expect(() =>
      compileReadPlan(
        plan({relations: [{path: "author", target: "unknown", type: "one", stage: "filter"}]}),
        ctx
      )
    ).toThrow(/target table 'unknown' is unknown/);
  });

  /**
   * Nested relations: the child's join is attached to the target row **inside the same lateral** and its
   * result is merged in with `to_jsonb(target) || jsonb_build_object(...)`. Depth turns into nested
   * laterals, and every level stays within one query.
   */
  it("resolves a nested relation by merging the child's value into the target", () => {
    const {data} = compileReadPlan(
      plan({
        relations: [
          {
            path: "author",
            target: "bucket_67b3",
            type: "one",
            stage: "filter",
            children: [{path: "author", target: "bucket_67b3", type: "one", stage: "filter"}]
          }
        ]
      }),
      ctx
    );

    // The child's alias is prefixed with the parent path: the same name does not clash across two levels.
    expect(data.sql).toContain("r_author_author");
    expect(data.sql).toContain("jsonb_build_object('author', r_author_author.value)");
    expect(data.sql.match(/LEFT JOIN LATERAL/g)).toHaveLength(2);
  });
});

/**
 * `many` relations: an empty result is `[]` once resolved, and "any element" in a filter.
 */
describe("compileReadPlan — onetomany relation", () => {
  const editors = {path: "editors", target: "bucket_67b3", type: "many" as const};

  it("returns [] for an empty resolved relation instead of dropping the field", () => {
    const {data} = compileReadPlan(plan({relations: [{...editors, stage: "projection"}]}), ctx);
    expect(data.sql).toContain(`COALESCE(jsonb_agg(`);
    expect(data.sql).toContain(`'[]'::jsonb`);
  });

  it("compiles to EXISTS when a filter looks at a relation's sub-field", () => {
    const {data} = compileReadPlan(
      plan({
        relations: [{...editors, stage: "filter"}],
        filter: {
          kind: "binary",
          operator: "==",
          left: doc("editors", "name"),
          right: {kind: "literal", type: "string", value: "GNB"}
        }
      }),
      ctx
    );
    expect(data.sql).toContain("jsonb_array_elements(r_editors.value)");
    expect(data.sql).toContain(`el.value->>'name' = $1`);
    expect(data.params).toEqual(["GNB"]);
  });

  /** An unresolved relation is now a **plain column**: the id array is selected as it is. */
  it("returns an unresolved relation as the column itself", () => {
    const {data} = compileReadPlan(plan({}), ctx);
    expect(data.sql).toContain(`b."editors"`);
    expect(data.sql).not.toContain("unnest");
  });
});

describe("compileReadPlan — sorting and pagination", () => {
  it("translates sort directions", () => {
    const {data} = compileReadPlan(plan({sort: {created_at: -1, slug: 1}}), ctx);
    expect(data.sql).toContain('ORDER BY b."created_at" DESC, b."slug" ASC');
  });

  it("sorts by a translatable field through COALESCE", () => {
    const {data} = compileReadPlan(
      plan({
        sort: {title: 1},
        localize: {locale: "tr_TR", fallback: "en_US", properties: ["title"], stage: "projection"}
      }),
      ctx
    );
    expect(data.sql).toMatch(/ORDER BY COALESCE\(b\."title"->>\$\d+, b\."title"->>\$\d+\) ASC/);
  });

  it("rejects sorting by an unknown field", () => {
    expect(() => compileReadPlan(plan({sort: {missing: 1}}), ctx)).toThrow(
      /cannot sort by unknown/
    );
  });

  it("limit and skip are parameterized", () => {
    const {data} = compileReadPlan(plan({limit: 25, skip: 50}), ctx);
    expect(data.sql).toContain("LIMIT $1 OFFSET $2");
    expect(data.params).toEqual([25, 50]);
  });
});

describe("compileReadPlan — pagination is two statements (R17)", () => {
  it("returns data and count separately when paginate is true", () => {
    const {data, count} = compileReadPlan(
      plan({filter: gt(doc("views"), 500), paginate: true, limit: 25}),
      ctx
    );
    expect(data.sql).toContain("LIMIT");
    expect(count).toBeTruthy();
    expect(count.sql).toContain("count(*)::int AS total");
  });

  it("omits sort/limit/skip from the count query (same as builder.ts:82-88)", () => {
    const {count} = compileReadPlan(
      plan({
        filter: gt(doc("views"), 500),
        sort: {created_at: -1},
        limit: 25,
        skip: 10,
        paginate: true
      }),
      ctx
    );
    expect(count.sql).not.toContain("ORDER BY");
    expect(count.sql).not.toContain("LIMIT");
    expect(count.sql).not.toContain("OFFSET");
    expect(count.sql).toContain("WHERE");
  });

  it("does NOT use a window function for count, as measured (R17)", () => {
    const {data, count} = compileReadPlan(plan({paginate: true}), ctx);
    expect(data.sql).not.toContain("OVER ()");
    expect(count.sql).not.toContain("OVER ()");
  });

  it("only joins the relations the filter needs for count", () => {
    const {count} = compileReadPlan(
      plan({
        paginate: true,
        relations: [
          {path: "author", target: "bucket_67b3", type: "one", stage: "filter"},
          {path: "editors", target: "bucket_67b3", type: "many", stage: "projection"}
        ]
      }),
      ctx
    );
    expect(count.sql).toContain("r_author");
    expect(count.sql).not.toContain("r_editors");
  });
});

describe("compileReadPlan — projection", () => {
  it("include keeps only the requested columns", () => {
    const {data} = compileReadPlan(plan({projection: {include: ["slug", "views"]}}), ctx);
    expect(data.sql).toContain('b."slug"');
    expect(data.sql).toContain('b."views"');
    expect(data.sql).not.toContain('b."published"');
  });

  it("exclude drops the given column", () => {
    const {data} = compileReadPlan(plan({projection: {exclude: ["views"]}}), ctx);
    expect(data.sql).not.toContain('b."views"');
    expect(data.sql).toContain('b."slug"');
  });

  it("denied (field-level ACL) drops the column", () => {
    const {data} = compileReadPlan(plan({projection: {denied: ["slug"]}}), ctx);
    expect(data.sql).not.toContain('b."slug"');
  });

  it("_id stays regardless of the projection", () => {
    const {data} = compileReadPlan(plan({projection: {include: ["slug"]}}), ctx);
    expect(data.sql).toContain('b."_id"');
  });
});

/**
 * Field-level ACL: the condition is evaluated **per document**. A static `denied` could not express
 * that — within one read the field shows on one row and not on another.
 */
describe("compileReadPlan — conditional projection (field-level ACL)", () => {
  it("compiles the condition to CASE WHEN, returning NULL when it is false", () => {
    const {data} = compileReadPlan(
      plan({projection: {conditional: [{path: "slug", when: gt(doc("views"), 10)}]}}),
      ctx
    );
    expect(data.sql).toContain(`CASE WHEN (b."views" > $1) THEN b."slug" ELSE NULL END AS "slug"`);
    expect(data.params).toEqual([10]);
  });

  it("leaves unconditional columns alone", () => {
    const {data} = compileReadPlan(
      plan({projection: {conditional: [{path: "slug", when: gt(doc("views"), 10)}]}}),
      ctx
    );
    expect(data.sql).toContain('b."published"');
    expect(data.sql).not.toContain('CASE WHEN (b."views" > $1) THEN b."published"');
  });

  it("wraps the localized value on a translatable column", () => {
    const {data} = compileReadPlan(
      plan({
        localize: {locale: "tr_TR", fallback: "en_US", properties: ["title"], stage: "projection"},
        projection: {conditional: [{path: "title", when: gt(doc("views"), 10)}]}
      }),
      ctx
    );
    expect(data.sql).toMatch(/CASE WHEN .* THEN COALESCE\(b\."title"->>\$\d/);
  });

  /** `auth.*` belongs to the request; the plan carries it, not the collection object (which is shared). */
  it("resolves the auth chain from the plan's identity", () => {
    const {data} = compileReadPlan(
      plan({
        auth: {identifier: "spica"},
        projection: {
          conditional: [
            {
              path: "slug",
              when: {
                kind: "binary",
                operator: "==",
                left: doc("slug"),
                right: {
                  kind: "select",
                  left: {kind: "identifier", name: "auth"},
                  right: {kind: "identifier", name: "identifier"}
                }
              }
            }
          ]
        }
      }),
      ctx
    );
    expect(data.params).toEqual(["spica"]);
  });
});

describe("compileReadPlan — the single statement rule", () => {
  it("data is a single SELECT statement and contains no semicolon", () => {
    const {data} = compileReadPlan(
      plan({
        filter: gt(doc("views"), 5),
        relations: [{path: "author", target: "bucket_67b3", type: "one", stage: "projection"}],
        localize: {locale: "tr_TR", fallback: "en_US", properties: ["title"], stage: "projection"},
        sort: {created_at: -1},
        limit: 25
      }),
      ctx
    );
    expect(data.sql).not.toContain(";");
    expect(data.sql.match(/\bUNION\b/)).toBeNull();
  });
});
