import {describe, expect, it} from "@jest/globals";
import {fromLegacyAst, TableSpec, UnsupportedExpressionError} from "@spica-server/database-driver";
import {compileExpression} from "@spica-server/database-postgres";
// The REAL parser — the proof that the adapter works on real output.
import {parser} from "@spica-server/bucket-expression/src/parser";

const table: TableSpec = {
  collection: "bucket_67a1",
  columns: [
    {name: "title", kind: "text"},
    {name: "age", kind: "number"},
    {name: "gender", kind: "text"},
    {name: "published", kind: "boolean"},
    {name: "tags", kind: "textArray"},
    {name: "meta", kind: "json"},
    {name: "description", kind: "json", translated: true}
  ]
};

const locale = {best: "tr_TR", fallback: "en_US"};

/** End to end: text → parser → adapter → SQL */
const toSql = (expression: string, extra: Record<string, any> = {}) =>
  compileExpression(fromLegacyAst(parser.parse(expression)), {table, locale, ...extra});

describe("real parser output → the contract's AST → SQL", () => {
  it("the example from the controller documentation: age > 35", () => {
    const {sql, params} = toSql("document.age > 35");
    expect(sql).toBe('("age" > $1)');
    expect(params).toEqual([35]);
  });

  it('name == "James"', () => {
    const {sql, params} = toSql('document.title == "James"');
    expect(sql).toBe('("title" = $1)');
    expect(params).toEqual(["James"]);
  });

  it("age > 35 && age < 50", () => {
    const {sql, params} = toSql("document.age > 35 && document.age < 50");
    expect(sql).toBe('(("age" > $1) AND ("age" < $2))');
    expect(params).toEqual([35, 50]);
  });

  it('gender == "F" && age > 20', () => {
    const {sql} = toSql('document.gender == "F" && document.age > 20');
    expect(sql).toBe('(("gender" = $1) AND ("age" > $2))');
  });

  it("alternatives with ||", () => {
    const {sql} = toSql('document.title == "a" || document.title == "b"');
    expect(sql).toBe('(("title" = $1) OR ("title" = $2))');
  });

  it("a parenthesized negation", () => {
    const {sql} = toSql('!(document.title == "a")');
    expect(sql).toBe('NOT (("title" = $1))');
  });

  it("arithmetic inside a comparison", () => {
    const {sql} = toSql("document.age * 2 > 100");
    expect(sql).toBe('(("age" * $1) > $2)');
  });

  it("the ACL default true==true", () => {
    const {sql} = toSql("true==true");
    expect(sql).toBe("($1 = $2)");
  });

  it("an auth chain is resolved at compile time", () => {
    const {sql, params} = toSql("document.title == auth.identifier", {
      auth: {identifier: "ali@example.com"}
    });
    expect(sql).toBe('("title" = $1)');
    expect(params).toEqual(["ali@example.com"]);
  });

  it("nested jsonb access", () => {
    const {sql} = toSql('document.meta.note == "n"');
    expect(sql).toBe("(\"meta\"->>'note' = $1)");
  });

  it("a translatable field with COALESCE", () => {
    const {sql, params} = toSql('document.description == "Merhaba"');
    expect(sql).toContain("COALESCE");
    expect(params).toEqual(["tr_TR", "en_US", "Merhaba"]);
  });

  it("the regex builtin", () => {
    const {sql} = toSql('regex(document.title, "^a", "i")');
    expect(sql).toBe('("title" ~* $1)');
  });

  it("the some builtin compiles into an array intersection", () => {
    const {sql, params} = toSql('some(document.tags, ["a", "b"])');
    expect(sql).toBe('("tags" && ARRAY[$1, $2])');
    expect(params).toEqual(["a", "b"]);
  });

  it("the has builtin", () => {
    const {sql} = toSql("has(document.title)");
    expect(sql).toBe('("title" IS NOT NULL)');
  });

  it("the length builtin on an array column", () => {
    const {sql} = toSql("length(document.tags) > 2");
    expect(sql).toContain("array_length");
  });

  it("the ternary operator", () => {
    const {sql} = toSql("document.published == true ? document.age > 10 : document.age > 100");
    expect(sql).toContain("AND");
    expect(sql).toContain("NOT");
  });
});

describe("the adapter — unsupported nodes do not stay silent", () => {
  /**
   * `in` is compiled on PG now — the JSON filter bridge (`fromMongoFilter`) produces it for
   * `$in`/`$nin` and that path only runs on the PG leg (the Mongo leg hands the raw filter to the
   * pipeline).
   *
   * **The remaining asymmetry, deliberately recorded:** `in` is still absent from `convert.ts`, so a
   * user who writes `"a" in document.tags` as a CEL string gets a 400 on MongoDB and a result on
   * PostgreSQL. It is not a silent difference (one side raises explicitly) but it is a parity gap;
   * closing it means adding `in` to the Mongo target, and it stands as D2 in the dependency register
   * in `docs/postgresql-backend-plan.md`.
   */
  it("`in` compiles into membership on an array column on PG", () => {
    const {sql} = toSql('"a" in document.tags');
    expect(sql).toBe(`($1 = ANY("tags"))`);
  });

  it("an unknown builtin is rejected", () => {
    expect(() => toSql("unknown(document.title)")).toThrow(UnsupportedExpressionError);
  });

  it("input that is not a parser node is rejected", () => {
    expect(() => fromLegacyAst(null)).toThrow(UnsupportedExpressionError);
    expect(() => fromLegacyAst("text")).toThrow(UnsupportedExpressionError);
  });
});
