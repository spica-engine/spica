import {describe, expect, it} from "@jest/globals";
import {Expression, TableSpec, UnsupportedExpressionError} from "@spica-server/database-driver";
import {compileExpression} from "@spica-server/database-postgres";

const table: TableSpec = {
  collection: "bucket_67a1",
  columns: [
    {name: "title", kind: "text"},
    {name: "views", kind: "number"},
    {name: "published", kind: "boolean"},
    {name: "released_at", kind: "timestamp"},
    {name: "tags", kind: "textArray"},
    {name: "meta", kind: "json"},
    {name: "author", kind: "reference", target: "bucket_67b3"},
    {name: "description", kind: "json", translated: true}
  ]
};

const locale = {best: "tr_TR", fallback: "en_US"};
const compile = (expression: Expression, extra: Record<string, any> = {}) =>
  compileExpression(expression, {table, locale, ...extra});

// ── AST shorthands
const lit = (
  value: any,
  type: any = typeof value === "number" ? "double" : typeof value === "boolean" ? "bool" : "string"
): Expression => ({kind: "literal", type, value}) as Expression;
const id = (name: string): Expression => ({kind: "identifier", name});
const doc = (...path: string[]): Expression =>
  path.reduce<Expression>(
    (left, name) => ({kind: "select", left, right: {kind: "identifier", name}}),
    id("document")
  );
const auth = (...path: string[]): Expression =>
  path.reduce<Expression>(
    (left, name) => ({kind: "select", left, right: {kind: "identifier", name}}),
    id("auth")
  );
const bin = (operator: any, left: Expression, right: Expression): Expression => ({
  kind: "binary",
  operator,
  left,
  right
});
const call = (callee: any, ...args: Expression[]): Expression => ({
  kind: "call",
  callee,
  arguments: args
});
const list = (...elements: Expression[]): Expression => ({kind: "list", elements});

describe("compileExpression — comparison", () => {
  it("equality is produced parameterized, the value is not embedded in the SQL", () => {
    const {sql, params} = compile(bin("==", doc("title"), lit("a")));
    expect(sql).toBe('("title" = $1)');
    expect(params).toEqual(["a"]);
  });

  it.each([
    [">", ">"],
    [">=", ">="],
    ["<", "<"],
    ["<=", "<="],
    // `!=` is NULL-safe: Mongo's `$ne` matches a missing field and `crud-filter-to-sql` made the
    // same decision; the two surfaces were compiling the same filter differently.
    ["!=", "IS DISTINCT FROM"]
  ])("%s → %s", (cel, sqlOp) => {
    const {sql} = compile(bin(cel, doc("views"), lit(30)));
    expect(sql).toBe(`("views" ${sqlOp} $1)`);
  });

  it("a comparison against null becomes IS NULL", () => {
    expect(compile(bin("==", doc("title"), lit(null, "null"))).sql).toBe('"title" IS NULL');
    expect(compile(bin("!=", doc("title"), lit(null, "null"))).sql).toBe('"title" IS NOT NULL');
  });

  it("identifiers are quoted", () => {
    expect(compile(bin("==", doc("released_at"), lit("x"))).sql).toContain('"released_at"');
  });

  it("the columns are qualified when an alias is given", () => {
    expect(compile(bin("==", doc("title"), lit("a")), {alias: "p"}).sql).toBe('(p."title" = $1)');
  });
});

describe("compileExpression — logical", () => {
  it("&& and || are combined with parentheses", () => {
    const {sql, params} = compile(
      bin("&&", bin(">", doc("views"), lit(30)), bin("==", doc("published"), lit(true)))
    );
    expect(sql).toBe('(("views" > $1) AND ("published" = $2))');
    expect(params).toEqual([30, true]);
  });

  it("nested || is grouped correctly", () => {
    const {sql} = compile(
      bin("||", bin("==", doc("title"), lit("a")), bin("==", doc("title"), lit("b")))
    );
    expect(sql).toBe('(("title" = $1) OR ("title" = $2))');
  });

  it("a not predicate is wrapped in NOT", () => {
    const {sql} = compile({
      kind: "unary",
      operator: "not",
      operand: bin("==", doc("title"), lit("a"))
    } as Expression);
    expect(sql).toBe('NOT (("title" = $1))');
  });

  it("the ternary operator expands the same way as in convert.ts", () => {
    const {sql} = compile({
      kind: "conditional",
      test: bin("==", doc("published"), lit(true)),
      consequent: bin(">", doc("views"), lit(10)),
      alternative: bin(">", doc("views"), lit(100))
    } as Expression);
    expect(sql).toContain("AND");
    expect(sql).toContain("NOT");
    expect(sql).toContain("OR");
  });

  it("a constant true predicate (the ACL default) becomes TRUE", () => {
    expect(compile(bin("==", lit(true), lit(true))).sql).toBe("($1 = $2)");
    expect(compile(lit(true)).sql).toBe("TRUE");
  });
});

describe("compileExpression — auth is resolved at compile time", () => {
  it("auth.identifier belongs to the identity, not the row: it is bound", () => {
    const {sql, params} = compile(bin("==", doc("title"), auth("identifier")), {
      auth: {identifier: "ali@example.com"}
    });
    expect(sql).toBe('("title" = $1)');
    expect(params).toEqual(["ali@example.com"]);
  });

  it("a nested path inside auth is resolved", () => {
    const {params} = compile(bin("==", doc("title"), auth("attributes", "role")), {
      auth: {attributes: {role: "admin"}}
    });
    expect(params).toEqual(["admin"]);
  });

  it("a path that is not in auth becomes NULL", () => {
    expect(compile(bin("==", doc("title"), auth("missing")), {auth: {}}).sql).toBe(
      '"title" IS NULL'
    );
  });
});

describe("compileExpression — multiple languages", () => {
  it("a translatable field is resolved with COALESCE", () => {
    const {sql, params} = compile(bin("==", doc("description"), lit("Merhaba")));
    expect(sql).toBe('(COALESCE("description"->>$1, "description"->>$2) = $3)');
    expect(params).toEqual(["tr_TR", "en_US", "Merhaba"]);
  });

  it("raises loudly when no locale is given", () => {
    expect(() => compileExpression(bin("==", doc("description"), lit("x")), {table})).toThrow(
      UnsupportedExpressionError
    );
  });
});

describe("compileExpression — a jsonb path", () => {
  it("nested access ends with ->>", () => {
    const {sql} = compile(bin("==", doc("meta", "note"), lit("n")));
    expect(sql).toBe("(\"meta\"->>'note' = $1)");
  });

  it("two levels of nested access", () => {
    const {sql} = compile(bin("==", doc("meta", "a", "b"), lit("x")));
    expect(sql).toBe("(\"meta\"->'a'->>'b' = $1)");
  });

  it("nested access on a non-json column is rejected", () => {
    expect(() => compile(bin("==", doc("title", "alt"), lit("x")))).toThrow(
      UnsupportedExpressionError
    );
  });
});

describe("compileExpression — builtins", () => {
  it("regex → ~ (case sensitive)", () => {
    const {sql, params} = compile(call("regex", doc("title"), lit("^a")));
    expect(sql).toBe('("title" ~ $1)');
    expect(params).toEqual(["^a"]);
  });

  it("regex flags 'i' → ~*", () => {
    expect(compile(call("regex", doc("title"), lit("^a"), lit("i"))).sql).toBe('("title" ~* $1)');
  });

  it("some → array intersection (&&), indexable with GIN", () => {
    const {sql, params} = compile(call("some", doc("tags"), list(lit("a"), lit("b"))));
    expect(sql).toBe('("tags" && ARRAY[$1, $2])');
    expect(params).toEqual(["a", "b"]);
  });

  it("every → array containment (@>)", () => {
    expect(compile(call("every", doc("tags"), list(lit("a")))).sql).toBe('("tags" @> ARRAY[$1])');
  });

  it("equal → array equality", () => {
    expect(compile(call("equal", doc("tags"), list(lit("a")))).sql).toBe('("tags" = ARRAY[$1])');
  });

  it("has → IS NOT NULL", () => {
    expect(compile(call("has", doc("title"))).sql).toBe('("title" IS NOT NULL)');
  });

  it("length: array_length on an array column", () => {
    expect(compile(bin(">", call("length", doc("tags")), lit(2))).sql).toBe(
      '(COALESCE(array_length("tags", 1), 0) > $1)'
    );
  });

  it("length: length() on a text column", () => {
    expect(compile(bin(">", call("length", doc("title")), lit(3))).sql).toBe(
      '(length("title") > $1)'
    );
  });

  it("now() ve unixTime()", () => {
    expect(compile(bin("<", doc("released_at"), call("now"))).sql).toBe('("released_at" < now())');
    expect(compile(bin(">", call("unixTime", doc("released_at")), lit(0))).sql).toContain(
      "EXTRACT(EPOCH FROM"
    );
  });
});

describe("compileExpression — arithmetic", () => {
  it("arithmetic can be used inside a comparison", () => {
    const {sql} = compile(bin(">", bin("*", doc("views"), lit(2)), lit(100)));
    expect(sql).toBe('(("views" * $1) > $2)');
  });

  it("the mod operator", () => {
    expect(compile(bin("==", bin("%", doc("views"), lit(2)), lit(0))).sql).toBe(
      '(("views" % $1) = $2)'
    );
  });
});

describe("compileExpression — the closed set rejects loudly", () => {
  it("an unknown root identifier", () => {
    const bad = {
      kind: "select",
      left: id("rastgele"),
      right: {kind: "identifier", name: "x"}
    } as Expression;
    expect(() => compile(bin("==", bad, lit("a")))).toThrow(/unknown root identifier/);
  });

  it("a property that is not on the bucket", () => {
    expect(() => compile(bin("==", doc("missing"), lit("a")))).toThrow(
      /not a property of this bucket/
    );
  });

  /**
   * A bare identifier is now a **document field** — the Mongo target behaves the same way
   * (`convert.ts:visitIdentifier` turns it into `$name`) and user filters often leave the prefix out.
   * What gets rejected is a field that is **not** in the document.
   */
  it("a bare identifier counts as a document field", () => {
    expect(compile(bin("==", id("title"), lit("a")))).toEqual({
      sql: '("title" = $1)',
      params: ["a"]
    });
  });

  it("a bare identifier is rejected when it is not in the document", () => {
    expect(() => compile(bin("==", id("missing"), lit("a")))).toThrow(
      /not a property of this bucket/
    );
  });

  it("an unsupported builtin", () => {
    expect(() => compile(call("unknown" as any, doc("title")))).toThrow(UnsupportedExpressionError);
  });

  it("a non-literal element in some's list argument", () => {
    expect(() => compile(call("some", doc("tags"), list(doc("title"))))).toThrow(
      /non-literal element/
    );
  });

  it("the error object carries the backend and the code", () => {
    try {
      compile(bin("==", doc("missing"), lit("a")));
      throw new Error("the expected error was not raised");
    } catch (error: any) {
      expect(error.code).toBe("UNSUPPORTED_EXPRESSION");
      expect(error.backend).toBe("postgres");
    }
  });
});

describe("compileExpression — parameter numbering", () => {
  it("several fragments can be combined with paramOffset", () => {
    const {sql, params} = compileExpression(bin("==", doc("title"), lit("a")), {
      table,
      locale,
      paramOffset: 3
    });
    expect(sql).toBe('("title" = $4)');
    expect(params).toEqual(["a"]);
  });
});
