import {describe, expect, it} from "@jest/globals";
import {
  fromMongoAggExpression,
  fromMongoFilter,
  TableSpec,
  UnsupportedExpressionError
} from "@spica-server/database-driver";
import {compileCrudFilter, compileExpression} from "@spica-server/database-postgres";
// The REAL compiler — the proof that the tree the bridge produces makes it out as SQL.
import * as expression from "@spica-server/bucket-expression";

const table: TableSpec = {
  collection: "bucket_67a1",
  columns: [
    {name: "title", kind: "text"},
    {name: "age", kind: "number"},
    {name: "published", kind: "boolean"},
    {name: "user", kind: "reference", target: "bucket_aa01"},
    {name: "meta", kind: "json"},
    // For the builtins that only mean something over an array or a date.
    {name: "tags", kind: "textArray"},
    {name: "created_at", kind: "timestamp"}
  ]
};

const compile = (filter: Record<string, any>) =>
  compileExpression(fromMongoFilter(filter)!, {table, alias: "b"});

describe("fromMongoFilter", () => {
  it("translates an implicit equality into ==", () => {
    const {sql, params} = compile({title: "Jim"});
    expect(sql).toBe(`(b."title" = $1)`);
    expect(params).toEqual(["Jim"]);
  });

  it("translates the comparison operators", () => {
    expect(compile({age: {$gt: 22}}).sql).toBe(`(b."age" > $1)`);
    expect(compile({age: {$lte: 25}}).sql).toBe(`(b."age" <= $1)`);
    expect(compile({age: {$ne: 38}}).sql).toBe(`(b."age" IS DISTINCT FROM $1)`);
  });

  it("combines two operators on the same field with AND", () => {
    const {sql, params} = compile({age: {$gte: 20, $lt: 30}});
    expect(sql).toBe(`((b."age" >= $1) AND (b."age" < $2))`);
    expect(params).toEqual([20, 30]);
  });

  it("translates $and / $or / $nor", () => {
    expect(compile({$and: [{title: "a"}, {age: 1}]}).sql).toBe(
      `((b."title" = $1) AND (b."age" = $2))`
    );
    expect(compile({$or: [{title: "a"}, {age: 1}]}).sql).toBe(
      `((b."title" = $1) OR (b."age" = $2))`
    );
    expect(compile({$nor: [{title: "a"}]}).sql).toContain("NOT");
  });

  it("translates $in and $nin", () => {
    expect(compile({title: {$in: ["a", "b"]}}).sql).toBe(`(b."title" IN ($1, $2))`);
    // `$nin` matches a missing field too — the rationale is in the bridge.
    expect(compile({title: {$nin: ["a"]}}).sql).toBe(
      `(NOT ((b."title" IN ($1))) OR b."title" IS NULL)`
    );
  });

  it("translates $regex into the regex() builtin", () => {
    const {sql} = compile({title: {$regex: "i"}});
    expect(sql).toMatch(/~/);
  });

  it("translates $exists into a NULL comparison", () => {
    expect(compile({title: {$exists: true}}).sql).toBe(`b."title" IS NOT NULL`);
    expect(compile({title: {$exists: false}}).sql).toBe(`b."title" IS NULL`);
  });

  /**
   * The **reason this bridge exists**: a dotted path enters a relation, and a selection chain has to be built
   * so that the plan producer can see it as a relation path. No relation context is given here, so the
   * compiler raises loudly — it does not silently read the wrong column.
   */
  it("translates a dotted path into a selection chain", () => {
    const tree = fromMongoFilter({"user.name": "GNB"})!;
    expect(tree).toEqual({
      kind: "binary",
      operator: "==",
      left: {
        kind: "select",
        left: {
          kind: "select",
          left: {kind: "identifier", name: "document"},
          right: {kind: "identifier", name: "user"}
        },
        right: {kind: "identifier", name: "name"}
      },
      right: {kind: "literal", type: "string", value: "GNB"}
    });
  });

  it("carries ObjectId and Date values through as they are", () => {
    const date = new Date("2020-10-19T12:00:00.000Z");
    const tree: any = fromMongoFilter({age: {$gte: 1}, title: "x"});
    expect(tree).toBeTruthy();
    const dated: any = fromMongoFilter({title: date});
    expect(dated.right).toEqual({kind: "literal", type: "string", value: date});
  });

  it("does not stay silent on an unknown operator", () => {
    expect(() => fromMongoFilter({title: {$near: 1}})).toThrow(UnsupportedExpressionError);
    expect(() => fromMongoFilter({$where: "x"})).toThrow(UnsupportedExpressionError);
  });
});

describe("fromMongoAggExpression", () => {
  it("translates the comparison inside $expr", () => {
    const tree = fromMongoAggExpression({$eq: ["$title", "Jim"]});
    const {sql, params} = compileExpression(tree, {table, alias: "b"});
    expect(sql).toBe(`(b."title" = $1)`);
    expect(params).toEqual(["Jim"]);
  });

  /**
   * Realtime's **real** input: when a CEL string is compiled in `"match"` mode the output is `{$expr: …}`. The
   * bridge has to be able to turn that output back into the canonical tree, otherwise realtime filters do not
   * work at all on PG.
   */
  it("accepts the match output of expression.aggregate", () => {
    const match: any = expression.aggregate(`title == "second"`, {}, "match");
    expect(Object.keys(match)).toEqual(["$expr"]);

    const {sql, params} = compileExpression(fromMongoAggExpression(match.$expr), {
      table,
      alias: "b"
    });
    expect(sql).toBe(`(b."title" = $1)`);
    expect(params).toEqual(["second"]);
  });

  /**
   * In "match" mode `&&` does **not** go inside `$expr`: the output is `{$and: [{$expr: …}, {$expr: …}]}`. So
   * the real entry point of a realtime filter is `compileCrudFilter`; it handles the `$and` and passes only
   * the `$expr` sub-trees to the bridge. In my first version I called the bridge directly with `match.$expr`
   * and that field did not exist.
   */
  it("compiles the $and + $expr filter realtime produces", () => {
    const match: any = expression.aggregate(`title == "a" && age > 5`, {}, "match");
    expect(Object.keys(match)).toEqual(["$and"]);

    const {sql, params} = compileCrudFilter(match, {table, alias: "b"});
    expect(sql).toBe(`(((b."title" = $1)) AND ((b."age" > $2)))`);
    expect(params).toEqual(["a", 5]);
  });

  /**
   * The CEL parser turns a 24-digit hex string into an `ObjectId`, so the value of a
   * `document._id == "<hex>"` filter is an **object**. The bridge took it for an operator document and threw
   * `aggregation operator 'buffer'`, which is why realtime's `_id` filter did not work at all (because the
   * error was swallowed during the websocket setup, the only symptom was a timeout).
   */
  it("does not take an ObjectId value for an operator", () => {
    const match: any = expression.aggregate(
      `document._id == "6abad0864018fd8b7d1dcc21"`,
      {},
      "match"
    );
    const {sql, params} = compileCrudFilter({$and: [match]}, {table});
    expect(sql).toContain(`"_id" = $1`);
    expect(params).toEqual(["6abad0864018fd8b7d1dcc21"]);
  });

  it("rejects a system variable", () => {
    expect(() => fromMongoAggExpression("$$ROOT")).toThrow(UnsupportedExpressionError);
  });

  /**
   * `regex()` goes through this bridge because the CEL converter's `match` output is a Mongo
   * `$expr` — the path the management endpoints and the bucket `$expr` fallback both take. The PG
   * compiler has always supported `regex` natively; what was missing was the round trip back.
   */
  it("turns $regexMatch back into the regex builtin", () => {
    const match: any = expression.aggregate(`regex(document.title, "^Ji")`, {}, "match");
    const {sql, params} = compileCrudFilter({$and: [match]}, {table});
    expect(sql).toContain(`"title" ~ $1`);
    expect(params).toEqual(["^Ji"]);
  });

  it("honours the case-insensitive flag through the bridge", () => {
    const match: any = expression.aggregate(`regex(document.title, "^ji", "i")`, {}, "match");
    const {sql} = compileCrudFilter({$and: [match]}, {table});
    expect(sql).toContain(`"title" ~* $1`);
  });

  it("negates a regex predicate", () => {
    const match: any = expression.aggregate(`!regex(document.title, "^Ji")`, {}, "match");
    const {sql} = compileCrudFilter({$and: [match]}, {table});
    expect(sql).toContain("NOT");
    expect(sql).toContain(`"title" ~ $1`);
  });

  /**
   * `has(document.x)` is `{$gt: ["$x", null]}` — MongoDB answers it by BSON type ordering, SQL has no
   * such ordering and `"x" > NULL` is NULL. Compiled literally the filter matched **nothing** and said
   * so silently; the shape is recognized instead and becomes `IS NOT NULL`.
   */
  it("turns the has() shape into IS NOT NULL rather than a comparison with NULL", () => {
    const match: any = expression.aggregate(`has(document.title)`, {}, "match");
    const {sql} = compileCrudFilter({$and: [match]}, {table});
    expect(sql).toContain("IS NOT NULL");
    expect(sql).not.toContain("> NULL");
  });

  it("keeps a real comparison with null out of the has() shape", () => {
    // Only `$gt` spells `has`; every other comparison against null stays the comparison it is.
    const tree: any = fromMongoAggExpression({$gte: ["$age", null]});
    expect(tree.kind).toBe("binary");
    expect(tree.operator).toBe(">=");
    expect(tree.right.value).toBeNull();
  });

  /**
   * The remaining builtins, through the same round trip. The PostgreSQL compiler has always been able
   * to compile all five; what was missing was reading their Mongo representation back.
   */
  it("turns $size back into the length builtin", () => {
    const match: any = expression.aggregate(`length(document.tags) > 1`, {}, "match");
    const {sql, params} = compileCrudFilter({$and: [match]}, {table});
    expect(sql).toContain("array_length");
    expect(params).toEqual([1]);
  });

  /**
   * `some` and `every` need no recognizer of their own: each value becomes `value in target`, and the
   * `$or`/`$and` the converter wraps them in is exactly the intersection/containment the two mean.
   */
  it("compiles some() as an intersection over the array column", () => {
    const match: any = expression.aggregate(`some(document.tags, ["a","b"])`, {}, "match");
    const {sql, params} = compileCrudFilter({$and: [match]}, {table});
    expect(sql).toContain("ANY");
    expect(sql).toContain(" OR ");
    expect(params).toEqual(["a", "b"]);
  });

  it("compiles every() as containment over the array column", () => {
    const match: any = expression.aggregate(`every(document.tags, ["a","b"])`, {}, "match");
    const {sql} = compileCrudFilter({$and: [match]}, {table});
    expect(sql).toContain("ANY");
    expect(sql).toContain(" AND ");
  });

  it("turns the equal() shape back into an array comparison", () => {
    const match: any = expression.aggregate(`equal(document.tags, ["a"])`, {}, "match");
    const {sql, params} = compileCrudFilter({$and: [match]}, {table});
    expect(sql).toContain('"tags" =');
    expect(params).toEqual(["a"]);
  });

  it("turns the $toLong/$divide pair back into unixTime", () => {
    const match: any = expression.aggregate(`unixTime(document.created_at) > 5`, {}, "match");
    const {sql, params} = compileCrudFilter({$and: [match]}, {table});
    expect(sql).toContain("EXTRACT(EPOCH");
    expect(params).toEqual([5]);
  });

  /**
   * The mappings are **shape-bound**, not blanket operator support: an `$ifNull` with a real default means
   * something else, and refusing it by name is the only honest answer.
   */
  it("still refuses an $ifNull with a meaningful default", () => {
    expect(() => fromMongoAggExpression({$ifNull: ["$tags", ["fallback"]]})).toThrow(
      UnsupportedExpressionError
    );
  });

  it("still refuses a bare $setDifference and a bare $toLong", () => {
    for (const operator of ["$setDifference", "$toLong"]) {
      expect(() => fromMongoAggExpression({[operator]: ["$tags", []]})).toThrow(
        UnsupportedExpressionError
      );
    }
  });
});
