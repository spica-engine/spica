import {describe, expect, it} from "@jest/globals";
import {TableSpec, UnsupportedExpressionError} from "@spica-server/database-driver";
import {compileAggregate} from "@spica-server/database-postgres";

const activity: TableSpec = {
  collection: "activity",
  namespace: "spica",
  columns: [
    {name: "action", kind: "number"},
    {name: "identifier", kind: "text"},
    {name: "username", kind: "text"},
    {name: "resource", kind: "textArray"},
    {name: "created_at", kind: "timestamp"},
    /** A `json` column, so the whole-collection `$group` can sum a path into it (as `storage` does). */
    {name: "meta", kind: "json"}
  ]
};

const identity: TableSpec = {
  collection: "identity",
  namespace: "spica",
  columns: [
    {name: "identifier", kind: "text"},
    {name: "failedAttempts", kind: "json"}
  ]
};

const targets: Record<string, TableSpec> = {identity};

const compile = (pipeline: object[], resolve = (name: string) => targets[name]) =>
  compileAggregate(pipeline, {
    table: activity,
    qualified: 'spica."activity"',
    resolveTarget: resolve
  });

const rows = (pipeline: object[]) => {
  const plan = compile(pipeline);
  if (plan.kind !== "rows") throw new Error("expected a 'rows' plan");
  return plan.statement;
};

const lookupTriple = (as: string, from: string, field: string) => [
  {$lookup: {from, localField: as, foreignField: "_id", as}},
  {$unwind: {path: `$${as}`, preserveNullAndEmptyArrays: true}},
  {$set: {[as]: `$${as}.${field}`}}
];

describe("compileAggregate — listing stages", () => {
  it("a plain selection when there are no stages", () => {
    const {sql, params} = rows([]);
    expect(sql).toContain('FROM spica."activity"');
    expect(sql).not.toContain("JOIN");
    expect(params).toEqual([]);
  });

  it("$match + $sort + $skip + $limit", () => {
    const {sql, params} = rows([
      {$match: {action: 3}},
      {$sort: {_id: -1}},
      {$skip: 5},
      {$limit: 10}
    ]);
    expect(sql).toContain('WHERE "action" = $1');
    expect(sql).toContain('ORDER BY "_id" DESC');
    // The parameters are bound in pipeline order: $skip comes before $limit.
    expect(sql).toContain("OFFSET $2");
    expect(sql).toContain("LIMIT $3");
    expect(params).toEqual([3, 5, 10]);
  });

  it("two consecutive $match stages are combined with AND", () => {
    const {sql} = rows([{$match: {action: 3}}, {$match: {identifier: "a"}}]);
    expect(sql).toMatch(/WHERE \("action" = \$1\) AND \("identifier" = \$2\)/);
  });

  it("sorting on an unknown field is rejected", () => {
    expect(() => rows([{$sort: {missing: 1}}])).toThrow(/not a property of this collection/);
  });
});

/**
 * The `$lookup` + `$unwind` + `$set` triple is recognized **structurally**; there is no general
 * `$lookup` support. The single caller is `ActivityPipelineBuilder` and it has two instances.
 */
describe("compileAggregate — the relation resolution triple", () => {
  it("produces a LATERAL join and the resolved value takes the local name", () => {
    const {sql} = rows(lookupTriple("identifier", "identity", "identifier"));

    expect(sql).toContain("LEFT JOIN LATERAL");
    expect(sql).toContain('FROM spica."identity" l_identifier_t');
    expect(sql).toContain('WHERE l_identifier_t."_id" = a."identifier"');
    expect(sql).toContain('l_identifier.value AS "identifier"');
    // The columns that are not resolved come from the base table.
    expect(sql).toContain('a."action"');
  });

  /**
   * In the pipeline `$lookup` comes before `$match`, which means `?identifier=foo` filters the
   * **resolved** value. That is why the filter has to stay outside the join.
   */
  it("$match is applied OUTSIDE the join — it filters the resolved value", () => {
    const {sql, params} = rows([
      ...lookupTriple("identifier", "identity", "identifier"),
      {$match: {identifier: "user1"}}
    ]);

    const whereIndex = sql.lastIndexOf('WHERE "identifier" = $1');
    expect(whereIndex).toBeGreaterThan(sql.indexOf("LEFT JOIN LATERAL"));
    expect(sql).toContain(") resolved");
    expect(params).toEqual(["user1"]);
  });

  it("two triples side by side are both resolved", () => {
    const {sql} = rows([
      ...lookupTriple("identifier", "identity", "identifier"),
      ...lookupTriple("username", "identity", "identifier")
    ]);
    expect(sql.match(/LEFT JOIN LATERAL/g)).toHaveLength(2);
    expect(sql).toContain('l_username.value AS "username"');
  });
});

/**
 * The shape `function/log` uses: a temporary field, `as` ≠ `localField`, an `$ifNull` fallback and
 * `$unset`, with the group coming **after** `$sort`/`$limit`.
 */
/**
 * `bucket/history`'s listing projection carries computed expressions. The earlier version ignored
 * everything other than 0/1 and returned **every column** — the API silently produced the wrong shape.
 */
describe("compileAggregate — a computed $project", () => {
  it("$size on a json column becomes jsonb_array_length", () => {
    const {sql} = rows([{$project: {count: {$size: "$resource"}}}]);
    expect(sql).toContain('COALESCE(array_length("resource", 1), 0) AS "count"');
  });

  it("$convert turns _id into a timestamp", () => {
    const {sql} = rows([{$project: {date: {$convert: {input: "$_id", to: "date"}}}}]);
    expect(sql).toContain(
      'to_timestamp((\'x\' || substring("_id", 1, 8))::bit(32)::int) AS "date"'
    );
  });

  it("a computed projection returns _id as well — so does Mongo", () => {
    const {sql} = rows([{$project: {count: {$size: "$resource"}}}]);
    expect(sql).toContain('SELECT "_id"');
  });

  it("an unrecognized value does not stay SILENT", () => {
    expect(() => rows([{$project: {title: "yes"}}])).toThrow(/\$project value/);
  });

  it("an unrecognized computed expression is rejected", () => {
    expect(() => rows([{$project: {x: {$toUpper: "$identifier"}}}])).toThrow(
      /computed \$project expression/
    );
  });

  it("converting anything other than _id to a date is rejected", () => {
    expect(() => rows([{$project: {d: {$toDate: "$identifier"}}}])).toThrow(
      /only '_id' carries a timestamp/
    );
  });

  it("a computed field cannot be mixed with an exclusion", () => {
    expect(() => rows([{$project: {count: {$size: "$resource"}, action: 0}}])).toThrow(
      /mixing computed fields with exclusion/
    );
  });
});

describe("compileAggregate — the second join shape (function/log)", () => {
  const logGroup = [
    {$set: {fn_id: {$toObjectId: "$identifier"}}},
    {$lookup: {from: "identity", localField: "fn_id", foreignField: "_id", as: "fn"}},
    {$unwind: {path: "$fn", preserveNullAndEmptyArrays: true}},
    {$set: {identifier: {$ifNull: ["$fn.identifier", "$identifier"]}}},
    {$unset: ["fn", "fn_id"]}
  ];

  it("the fallback compiles into COALESCE — the original value stays when there is no match", () => {
    const {sql} = rows(logGroup);
    expect(sql).toContain('COALESCE(l_identifier.value, a."identifier") AS "identifier"');
  });

  /**
   * The split point comes from the pipeline: the stages before the join stay inside, so the join is
   * applied to the paginated rows only. The same decision as `ReadPlan`'s `stage: "projection"`.
   */
  it("the join is applied AFTER pagination", () => {
    const {sql, params} = rows([{$sort: {_id: -1}}, {$limit: 5}, ...logGroup]);

    const innerLimit = sql.indexOf("LIMIT $1");
    expect(innerLimit).toBeGreaterThan(-1);
    expect(sql.indexOf("LEFT JOIN LATERAL")).toBeGreaterThan(innerLimit);
    expect(params).toEqual([5]);
  });

  it("the parameters of the two layers are numbered continuously", () => {
    const {sql, params} = rows([
      {$match: {action: 3}},
      {$limit: 5},
      ...logGroup,
      {$match: {identifier: "user1"}}
    ]);

    expect(params).toEqual([3, 5, "user1"]);
    expect(sql).toContain('"action" = $1');
    expect(sql).toContain("LIMIT $2");
    expect(sql).toContain('"identifier" = $3');
  });

  it("$unset is rejected when it tries to remove a real column", () => {
    const stages = logGroup.map(stage => ({...stage}));
    (stages[4] as any).$unset = ["fn", "action"];
    expect(() => rows(stages)).toThrow(/only drop the group's temporaries/);
  });

  it("is rejected when the output field differs from the source column", () => {
    const stages = logGroup.map(stage => ({...stage}));
    (stages[3] as any).$set = {username: {$ifNull: ["$fn.identifier", "$username"]}};
    expect(() => rows(stages)).toThrow(/writes 'username' but reads 'identifier'/);
  });
});

/**
 * `$group` over the whole collection — the only shape the codebase uses, and all three call sites share it
 * (`storage`, `bucket/services`, `status/services`). Grouping **by a field** stays unsupported on purpose.
 */
describe("compileAggregate — whole-collection $group", () => {
  it("a constant _id with one $sum becomes a plain SQL aggregate", () => {
    const {sql, params} = rows([
      {$group: {_id: "", total: {$sum: "$meta.size"}}},
      {$project: {total: 1}}
    ]);
    /**
     * `double precision`, not `numeric`: `pg` returns `numeric` as a **string** and the callers do
     * arithmetic on the result, so a string made `existing + size` concatenate and the storage size limit
     * fired on an insert that fit.
     */
    expect(sql).toContain(`COALESCE(sum(("meta"->>'size')::double precision), 0) AS "total"`);
    expect(sql).toContain(`'' AS "_id"`);
    expect(params).toEqual([]);
  });

  /**
   * Mongo emits **no** document for an empty input and every caller reads `d.length ? d[0].total : 0`.
   * A bare SQL aggregate would return one NULL row and turn `total` into `null`.
   */
  it("an empty input produces no row, as in Mongo", () => {
    expect(rows([{$group: {_id: "", total: {$sum: "$action"}}}]).sql).toContain(
      "HAVING count(*) > 0"
    );
  });

  it("_id: null is carried as NULL", () => {
    expect(rows([{$group: {_id: null, n: {$sum: "$action"}}}]).sql).toContain(`NULL AS "_id"`);
  });

  it("several accumulators in one statement", () => {
    const {sql} = rows([{$group: {_id: null, a: {$sum: "$action"}, b: {$sum: "$meta.size"}}}]);
    expect(sql).toContain(`AS "a"`);
    expect(sql).toContain(`AS "b"`);
  });

  it("$sum: 1 counts the documents", () => {
    expect(rows([{$group: {_id: "", n: {$sum: 1}}}]).sql).toContain(
      `count(*)::double precision AS "n"`
    );
  });

  it("a preceding $match becomes the WHERE, parameterized", () => {
    const {sql, params} = rows([
      {$match: {action: 5}},
      {$group: {_id: "", total: {$sum: "$action"}}}
    ]);
    expect(sql).toContain("WHERE");
    expect(params).toEqual([5]);
  });

  it("a $project narrows which accumulators come back", () => {
    const {sql} = rows([
      {$group: {_id: null, a: {$sum: "$action"}, b: {$sum: "$action"}}},
      {$project: {a: 1}}
    ]);
    expect(sql).toContain(`AS "a"`);
    expect(sql).not.toContain(`AS "b"`);
  });

  /** Grouping by a field is `ReadPlan`'s job; imitating it would grow a second read engine. */
  it("grouping by a field is still rejected", () => {
    expect(() => rows([{$group: {_id: "$action", total: {$sum: 1}}}])).toThrow(/\$group/);
  });

  it("an accumulator other than $sum is still rejected", () => {
    expect(() => rows([{$group: {_id: "", top: {$max: "$action"}}}])).toThrow(/\$group/);
  });

  it("$sum over a non-numeric column is rejected", () => {
    expect(() => rows([{$group: {_id: "", total: {$sum: "$identifier"}}}])).toThrow(/column kind/);
  });

  it("a stage other than $match before the group is rejected", () => {
    expect(() => rows([{$sort: {action: 1}}, {$group: {_id: "", n: {$sum: 1}}}])).toThrow(
      /\$group/
    );
  });
});

describe("compileAggregate — an unrecognized shape does not stay SILENT", () => {
  it("a foreign field other than `_id` is rejected", () => {
    const stages = lookupTriple("identifier", "identity", "identifier");
    (stages[0] as any).$lookup.foreignField = "identifier";
    expect(() => rows(stages)).toThrow(/must join on the target's '_id'/);
  });

  it("is rejected without preserveNullAndEmptyArrays", () => {
    const stages = lookupTriple("identifier", "identity", "identifier");
    (stages[1] as any).$unwind.preserveNullAndEmptyArrays = false;
    expect(() => rows(stages)).toThrow(/\$unwind with preserveNullAndEmptyArrays/);
  });

  it("a $unwind outside the triple is rejected", () => {
    expect(() => rows([{$unwind: {path: "$resource"}}])).toThrow(
      /outside the recognized relation-resolution shape/
    );
  });

  it("an unknown target is rejected", () => {
    expect(() => rows(lookupTriple("identifier", "missing", "identifier"))).toThrow(
      /target 'missing' is unknown/
    );
  });

  it("a field that is not on the target is rejected", () => {
    expect(() => rows(lookupTriple("identifier", "identity", "missing"))).toThrow(
      /has no such property/
    );
  });

  /**
   * The resolved value comes back under the local column's name and the codec decodes it according to
   * the **local column's** type; if the types differ the row would be decoded wrongly and silently.
   */
  it("a type mismatch is rejected", () => {
    expect(() => rows(lookupTriple("identifier", "identity", "failedAttempts"))).toThrow(
      UnsupportedExpressionError
    );
  });

  it("$group is rejected", () => {
    expect(() => rows([{$group: {_id: "$action"}}])).toThrow(/aggregation stage '\$group'/);
  });
});
