import {describe, expect, it} from "@jest/globals";
import {readFileSync} from "fs";
import {ObjectId} from "bson";
import {TableSpec, UnsupportedExpressionError} from "@spica-server/database-driver";
import {compileCrudFilter, compileCrudUpdate} from "@spica-server/database-postgres";

const table: TableSpec = {
  collection: "bucket_67a1",
  columns: [
    {name: "title", kind: "text"},
    {name: "views", kind: "number"},
    {name: "published", kind: "boolean"},
    {name: "created_at", kind: "timestamp"},
    {name: "tags", kind: "textArray"},
    {name: "meta", kind: "json"},
    {name: "author", kind: "reference", target: "bucket_67b3"}
  ]
};

const f = (filter: any) => compileCrudFilter(filter, {table});

/** The `SUPPORTED` set is not exported; it is read from source — that list is exactly what this test is about. */
function listedOperators(): string[] {
  const source = readFileSync(
    new URL("../src/compiler/crud-filter-to-sql.ts", import.meta.url),
    "utf8"
  );
  const block = source.slice(source.indexOf("const SUPPORTED"));
  return [...block.slice(0, block.indexOf("]")).matchAll(/"(\$[a-zA-Z]+)"/g)].map(m => m[1]);
}
const u = (update: any, upsert = false) => compileCrudUpdate(update, {table, upsert});

describe("compileCrudFilter — equality and comparison", () => {
  it("plain equality", () => {
    expect(f({title: "a"})).toEqual({sql: '"title" = $1', params: ["a"]});
  });

  it("several fields joined with AND", () => {
    const {sql, params} = f({title: "a", views: 1});
    expect(sql).toBe('"title" = $1 AND "views" = $2');
    expect(params).toEqual(["a", 1]);
  });

  it("an empty filter is TRUE", () => {
    expect(f({}).sql).toBe("TRUE");
  });

  it("equality against null becomes IS NULL", () => {
    expect(f({title: null}).sql).toBe('"title" IS NULL');
  });

  it.each([
    ["$gt", ">"],
    ["$gte", ">="],
    ["$lt", "<"],
    ["$lte", "<="]
  ])("%s → %s", (op, sqlOp) => {
    expect(f({views: {[op]: 5}}).sql).toBe(`"views" ${sqlOp} $1`);
  });

  it("$eq ve $ne", () => {
    expect(f({title: {$eq: "a"}}).sql).toBe('"title" = $1');
    expect(f({title: {$ne: "a"}}).sql).toBe('("title" IS DISTINCT FROM $1)');
  });

  it("$ne null → IS NOT NULL", () => {
    expect(f({title: {$ne: null}}).sql).toBe('"title" IS NOT NULL');
  });

  it("two operators on the same field are joined with AND", () => {
    const {sql} = f({views: {$gte: 10, $lt: 20}});
    expect(sql).toBe('("views" >= $1 AND "views" < $2)');
  });
});

describe("compileCrudFilter — $in / $nin", () => {
  it("IN on a scalar column", () => {
    const {sql, params} = f({title: {$in: ["a", "b"]}});
    expect(sql).toBe('"title" IN ($1, $2)');
    expect(params).toEqual(["a", "b"]);
  });

  it("an ARRAY column intersects (&&) rather than using IN", () => {
    // In Mongo, {tags: {$in: ["a"]}} on an array field matches any element;
    // on a native array column the counterpart is intersection.
    expect(f({tags: {$in: ["a", "b"]}}).sql).toBe('("tags" && ARRAY[$1, $2])');
  });

  it("$nin on a scalar is NOT IN plus NULL safety", () => {
    expect(f({title: {$nin: ["a"]}}).sql).toBe('("title" NOT IN ($1) OR "title" IS NULL)');
  });

  it("$nin on an array is NOT intersection", () => {
    expect(f({tags: {$nin: ["a"]}}).sql).toBe('NOT ("tags" && ARRAY[$1])');
  });

  it("an empty $in matches nothing", () => {
    expect(f({title: {$in: []}}).sql).toBe("FALSE");
    expect(f({title: {$nin: []}}).sql).toBe("TRUE");
  });
});

describe("compileCrudFilter — $all", () => {
  /**
   * `$in` intersects, `$all` contains. The `activity` controller sends **both on the same column**
   * (`{resource: {$all: [...], $in: [...]}}`), and confusing the two would be a silent difference in
   * the data returned.
   */
  it("emits containment (@>) on an array column", () => {
    expect(f({tags: {$all: ["a", "b"]}})).toEqual({
      sql: '("tags" @> ARRAY[$1, $2])',
      params: ["a", "b"]
    });
  });

  it("$all and $in on one column are joined with AND", () => {
    const {sql} = f({tags: {$all: ["a"], $in: ["b", "c"]}});
    expect(sql).toContain("@>");
    expect(sql).toContain("&&");
  });

  it("is rejected on a scalar column", () => {
    expect(() => f({title: {$all: ["a"]}})).toThrow(/array columns only/);
  });

  it("an empty list matches no row — same as `$in: []`", () => {
    expect(f({tags: {$all: []}}).sql).toBe("FALSE");
  });
});

/**
 * The only caller is `bucket/history`: `changes` is an array of objects and the condition is scalar
 * equality on dotted paths. `$elemMatch` in a filter and a conditional `$pull` in an update use the
 * **same** shape.
 */
describe("compileCrudFilter — $elemMatch (a json array)", () => {
  it("emits EXISTS over jsonb_array_elements", () => {
    const {sql, params} = f({meta: {$elemMatch: {"path.0": "title"}}});
    expect(sql).toBe(
      "EXISTS (SELECT 1 FROM jsonb_array_elements(\"meta\") e WHERE e #>> '{path,0}' = $1)"
    );
    expect(params).toEqual(["title"]);
  });

  it("several paths are joined with AND", () => {
    const {sql} = f({meta: {$elemMatch: {"path.0": "a", "path.1": "b"}}});
    expect(sql).toContain("AND");
  });

  it("is rejected on a NON json column", () => {
    expect(() => f({tags: {$elemMatch: {x: 1}}})).toThrow(/column kind 'textArray'/);
  });

  it("a non-scalar value is rejected", () => {
    expect(() => f({meta: {$elemMatch: {"path.0": {$gt: 1}}}})).toThrow(/non-scalar value/);
  });
});

describe("compileCrudUpdate — conditional $pull (json array)", () => {
  it("removes elements by re-aggregating the ones that do not match", () => {
    const {sql, params} = u({$pull: {meta: {"path.0": "title"}}});
    expect(sql).toContain("jsonb_agg(e)");
    expect(sql).toContain("WHERE NOT (e #>> '{path,0}' = $1)");
    // `jsonb_agg` returns NULL once every element is removed; Mongo leaves an empty array.
    expect(sql).toContain("'[]'::jsonb");
    expect(params).toEqual(["title"]);
  });

  it("rejects a scalar where a condition is expected on a json column", () => {
    expect(() => u({$pull: {meta: "title"}})).toThrow(/expects an element condition/);
  });
});

describe("compileCrudFilter — logical operators", () => {
  it("$and", () => {
    expect(f({$and: [{title: "a"}, {views: 1}]}).sql).toBe('("title" = $1 AND "views" = $2)');
  });

  it("$or", () => {
    expect(f({$or: [{title: "a"}, {title: "b"}]}).sql).toBe('("title" = $1 OR "title" = $2)');
  });

  it("$nor", () => {
    expect(f({$nor: [{title: "a"}]}).sql).toBe('NOT ("title" = $1)');
  });

  it("$not at the field level", () => {
    expect(f({views: {$not: {$gt: 5}}}).sql).toBe('NOT ("views" > $1)');
  });

  it("nested $or inside $and", () => {
    const {sql} = f({$or: [{$and: [{title: "a"}, {views: 1}]}, {published: true}]});
    expect(sql).toBe('(("title" = $1 AND "views" = $2) OR "published" = $3)');
  });
});

describe("compileCrudFilter — remaining operators", () => {
  it("$exists true/false", () => {
    expect(f({title: {$exists: true}}).sql).toBe('"title" IS NOT NULL');
    expect(f({title: {$exists: false}}).sql).toBe('"title" IS NULL');
  });

  it("$regex and $options are read together", () => {
    const {sql, params} = f({title: {$regex: "^a", $options: "i"}});
    expect(sql).toBe('("title" ~* $1)');
    expect(params).toEqual(["^a"]);
  });

  it("$regex given as a RegExp object", () => {
    expect(f({title: {$regex: /^a/}}).params).toEqual(["^a"]);
  });

  it("$size on an array column", () => {
    expect(f({tags: {$size: 2}}).sql).toBe('COALESCE(array_length("tags", 1), 0) = $1');
  });

  it("$mod", () => {
    expect(f({views: {$mod: [2, 0]}}).sql).toBe('(("views" % $1) = $2)');
  });

  it("an _id ObjectId is reduced to hex", () => {
    const id = new ObjectId();
    expect(f({_id: id}).params).toEqual([id.toHexString()]);
  });

  it("an ObjectId on a relation column is reduced to hex", () => {
    const id = new ObjectId();
    expect(f({author: id}).params).toEqual([id.toHexString()]);
  });

  it("a path inside jsonb", () => {
    expect(f({"meta.note": "n"}).sql).toBe("\"meta\"->>'note' = $1");
  });
});

/**
 * The two lists can drift apart, and when they do the symptom misleads: I added `$all` to the
 * `switch` but not to `SUPPORTED`, and the resulting `operator '$all'` error read as "not
 * implemented" when it in fact was. This test catches that drift.
 *
 * `$options` is a deliberate exception: it is consumed as `$regex`'s sibling and has no case of its own.
 */
describe("compileCrudFilter — SUPPORTED and the switch stay in step", () => {
  const siblingOnly = new Set(["$options"]);

  /**
   * An operator sits either inside a field (`{title: {$gt: …}}`) or at the root (`{$and: […]}`), and
   * those are two separate `switch` statements. The probe tries both: only an operator that reports
   * "unrecognised" in **both** positions is listed but unimplemented.
   */
  it("every listed operator really compiles", () => {
    const unrecognized = (filter: any) => {
      try {
        f(filter);
        return false;
      } catch (error: any) {
        return /operator '\$/.test(error.message);
      }
    };

    const unimplemented = listedOperators()
      .filter(operator => !siblingOnly.has(operator))
      .filter(
        operator =>
          unrecognized({title: {[operator]: "a"}}) && unrecognized({[operator]: [{title: "a"}]})
      );

    expect(unimplemented).toEqual([]);
  });
});

describe("compileCrudFilter — a closed set does not stay silent (K-4)", () => {
  it.each([["$text"], ["$where"], ["$geoWithin"], ["$bitsAllSet"]])("%s is rejected", op => {
    expect(() => f({title: {[op]: 1}})).toThrow(UnsupportedExpressionError);
  });

  it("$type is rejected (a column's type is fixed)", () => {
    expect(() => f({title: {$type: 2}})).toThrow(/column types are fixed/);
  });

  it("$elemMatch is not there yet, but it is not silent either", () => {
    expect(() => f({tags: {$elemMatch: {}}})).toThrow(/elemMatch/);
  });

  /**
   * `$expr` is no longer rejected: the realtime path produces it and does not use a `ReadPlan`, so
   * "go through a ReadPlan" was not a usable answer. The aggregation expression inside it is bridged
   * to the canonical tree and handed to the **same** CEL compiler.
   */
  it("compiles the aggregation expression inside $expr", () => {
    expect(f({$expr: {$eq: ["$title", "x"]}}).sql).toContain(`"title" = $1`);
  });

  it("does not stay silent on an unknown operator inside $expr", () => {
    expect(() => f({$expr: {$dateAdd: []}})).toThrow(/aggregation operator/);
  });

  it("a field that is not on the bucket", () => {
    expect(() => f({missing: 1})).toThrow(/not a property of this bucket/);
  });
});

describe("compileCrudUpdate", () => {
  it("$set", () => {
    const {sql, params} = u({$set: {title: "a", views: 2}});
    expect(sql).toBe('"title" = $1, "views" = $2');
    expect(params).toEqual(["a", 2]);
  });

  it("$set null", () => {
    expect(u({$set: {title: null}}).sql).toBe('"title" = NULL');
  });

  it("$unset → NULL", () => {
    expect(u({$unset: {title: ""}}).sql).toBe('"title" = NULL');
  });

  it("$inc is NULL safe", () => {
    expect(u({$inc: {views: 1}}).sql).toBe('"views" = COALESCE("views", 0) + $1');
  });

  it("$push appends on an array column", () => {
    expect(u({$push: {tags: "a"}}).sql).toBe(`"tags" = COALESCE("tags", '{}') || ARRAY[$1]`);
  });

  it("$push with $each appends several elements", () => {
    const {params} = u({$push: {tags: {$each: ["a", "b"]}}});
    expect(params).toEqual(["a", "b"]);
  });

  it("$addToSet prevents a duplicate", () => {
    expect(u({$addToSet: {tags: "a"}}).sql).toContain("DISTINCT");
  });

  it("$pull removes from an array column", () => {
    expect(u({$pull: {tags: "a"}}).sql).toBe('"tags" = array_remove("tags", $1)');
  });

  /**
   * `$setOnInsert` applies when an upsert **inserts**, and the insert is built by `upsertSeed`, so it
   * never contributes to a `SET` clause. It used to be applied whenever `upsert: true` was passed —
   * the opposite of Mongo, and silently destructive: `IdentityService.default()` sends
   * `{$setOnInsert: {...identity, password: hashed}}` on every boot and so reset an existing identity's
   * password to the default one.
   */
  it("$setOnInsert never assigns, with or without upsert (same as Mongo)", () => {
    expect(u({$setOnInsert: {title: "a"}}, false).sql).toBe("");
    expect(u({$setOnInsert: {title: "a"}}, true).sql).toBe("");
  });

  it("$setOnInsert next to another operator leaves only the other one", () => {
    expect(u({$inc: {views: 1}, $setOnInsert: {title: "a"}}, true)).toEqual({
      sql: '"views" = COALESCE("views", 0) + $1',
      params: [1]
    });
  });

  /**
   * An update that assigns nothing is a no-op, not an error — but an **empty** update document is a
   * programming error and stays loud.
   */
  it("an empty update document is rejected", () => {
    expect(() => u({})).toThrow(/no applicable operators/);
  });

  /**
   * `_id` is the implicit primary key and absent from `TableSpec.columns`; it used to be taken for an
   * undeclared field. On a table with an overflow column that meant `_extra` gained an `_id` string and,
   * because the codec merges the overflow column over the row, every updated row read back with a
   * **string** id instead of an id.
   */
  it("$set on _id targets the primary key column, not the overflow column", () => {
    const withOverflow: TableSpec = {...table, overflowColumn: "_extra"};
    const id = new ObjectId();
    const {sql, params} = compileCrudUpdate({$set: {_id: id}}, {table: withOverflow});
    expect(sql).toBe('"_id" = $1');
    expect(params).toEqual([id.toHexString()]);
  });

  /**
   * Replace writes the **omitted columns too**: in a document store a replace swaps the whole
   * document, so a field that is not given disappears. The previous shape only wrote the given fields
   * and behaved like `$set`; the rationale and the measured symptoms are in the compiler's comment.
   */
  it("an operator-less document replaces wholly: omitted columns become NULL, _id is skipped", () => {
    const {sql} = u({title: "a", views: 1, _id: new ObjectId()});
    expect(sql).toBe(
      '"title" = $1, "views" = $2, "published" = NULL, "created_at" = NULL, "tags" = NULL, ' +
        '"meta" = NULL, "author" = NULL'
    );
  });

  /**
   * `$[]` (positional-all) is not a fixed path: `#-` produces valid SQL but **deletes nothing**.
   * A field inside an array arrives in this shape when a bucket schema is updated.
   */
  it("$unset containing $[] compiles to the recursive helper", () => {
    const {sql, params} = u({$unset: {"meta.$[].note": ""}});
    expect(sql).toBe(`"meta" = spica.jsonb_unset_deep("meta", $1::text[])`);
    expect(params).toEqual(["{$[],note}"]);
  });

  it("$unset without $[] deletes via #-", () => {
    expect(u({$unset: {"meta.note": ""}}).sql).toContain("#-");
  });

  it("an unsupported update operator is rejected", () => {
    expect(() => u({$bit: {views: {and: 1}}})).toThrow(UnsupportedExpressionError);
  });

  /**
   * Writing to a **sub-path** of a `json` column **is supported** (Faz 7): `passport/user`'s config
   * updates are always shaped `{$set: {"options.foo": …}}`, and 119 tests were failing because of it.
   * `COALESCE` is required — `jsonb_set(NULL, …)` returns `NULL` and loses the write silently.
   */
  it("writes to a json column's sub-path with jsonb_set", () => {
    const {sql} = u({$set: {"meta.note": "n"}});
    expect(sql).toContain('"meta" = jsonb_set(COALESCE("meta"');
    expect(sql).toContain("::text[]");
    expect(sql).toContain("::jsonb, true)");
  });

  /**
   * Two sub-path writes to the same column produce a **single** assignment.
   *
   * `UPDATE … SET "meta" = …, "meta" = …` is `42701` in PostgreSQL. The real caller is
   * `passport/.../oauth/custom.ts:afterInsert`: it writes `redirect_uri` into both `code.params` and
   * `access_token.params` in one `$set`. The error was swallowed inside `afterInsert`, so the symptom
   * surfaced as a missing `redirect_uri` in the SSO login url.
   */
  it("two sub-paths on one json column fold into a single assignment", () => {
    const {sql} = u({$set: {"meta.a": 1, "meta.b": 2}});
    expect(sql.match(/"meta" =/g)).toHaveLength(1);
    expect(sql).toContain('jsonb_set(jsonb_set(COALESCE("meta"');
  });

  it("assigning both a whole value and a sub-path to one column is rejected", () => {
    // Mongo errors too (`conflict at 'meta'`); silently picking one would be a data difference.
    expect(() => u({$set: {"meta.a": 1, meta: {b: 2}}})).toThrow(UnsupportedExpressionError);
  });

  /**
   * `status/services` sends `{$inc: {count: 1, "request.size": n}}` on every API request, and
   * `request` is a jsonb column. While the dotted path was rejected the counter could not be written
   * at all on PostgreSQL.
   */
  it("$inc works on a json column's sub-path", () => {
    const {sql} = u({$inc: {"meta.size": 5}});
    expect(sql).toContain('"meta" = jsonb_set(COALESCE("meta"');
    expect(sql).toContain("::numeric, 0)");
    expect(sql).toContain("to_jsonb(");
  });

  it("$inc folds two sub-paths on one json column into a single assignment", () => {
    const {sql} = u({$inc: {"meta.a": 1, "meta.b": 2}});
    expect(sql.match(/"meta" =/g)).toHaveLength(1);
  });

  it("$inc emits addition on a plain column", () => {
    const {sql} = u({$inc: {views: 3}});
    expect(sql).toBe('"views" = COALESCE("views", 0) + $1');
  });

  it("a sub-path of a NON json column is rejected", () => {
    // `title` is text; `->>` is meaningless there, so it errors instead of writing the wrong thing (K-4).
    expect(() => u({$set: {"title.note": "n"}})).toThrow(/nested update path/);
  });

  it("$pull is rejected on a scalar column", () => {
    expect(() => u({$pull: {title: "a"}})).toThrow(/\$pull.*text/);
  });
});

/**
 * Aggregation **pipeline** updates. The array used to fall through to the operator-less path, which means
 * `replaceOne` semantics: every real column nulled and the pipeline itself written into the overflow column,
 * with no error. Renaming a storage folder destroyed the rows (R101).
 */
describe("compileCrudUpdate — a pipeline update", () => {
  const renamePipeline = (from: string, to: string) => [
    {
      $set: {
        title: {
          $cond: [
            {$eq: ["$title", from]},
            to,
            {$replaceOne: {input: "$title", find: from, replacement: to}}
          ]
        }
      }
    }
  ];

  it("the rename shape compiles to a CASE, with the values as parameters", () => {
    const {sql, params} = u(renamePipeline("folder/", "renamed/") as any);
    expect(sql).toContain('"title" = CASE');
    expect(sql).toContain('WHEN "title" = $1 THEN $2');
    expect(sql).toContain("overlay(");
    expect(params).toEqual(["folder/", "renamed/"]);
  });

  /**
   * `position`/`overlay` rather than `regexp_replace`: the two values stay plain parameters, so a folder
   * named with a regex metacharacter needs no escaping.
   */
  it("does not build a regular expression out of the values", () => {
    const {sql} = u(renamePipeline("a.b*", "c") as any);
    expect(sql).not.toContain("regexp_replace");
  });

  /** The destructive part: it must not compile to a replace. */
  it("an unrecognized pipeline raises instead of nulling the columns", () => {
    expect(() => u([{$set: {title: "plain"}}] as any)).toThrow(/update pipeline/);
    expect(() => u([{$unset: ["title"]}] as any)).toThrow(/update pipeline/);
    expect(() => u([] as any)).toThrow(/update pipeline/);
  });

  it("a pipeline on a non-text column raises", () => {
    const pipeline = [
      {
        $set: {
          views: {
            $cond: [
              {$eq: ["$views", "a"]},
              "b",
              {$replaceOne: {input: "$views", find: "a", replacement: "b"}}
            ]
          }
        }
      }
    ];
    expect(() => u(pipeline as any)).toThrow(/column kind/);
  });
});
