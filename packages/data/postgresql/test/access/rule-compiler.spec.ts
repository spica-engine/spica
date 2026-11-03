import {hash} from "@spica-server/core-encryption";
import {
  compileRule,
  InvalidRuleError,
  RuleCompileError,
  UnsupportedRuleError
} from "@spica-server/data-postgresql";
import {InlineValues} from "@spica-server/data-postgresql-orm";
import {bucketId, ruleBucket, ruleMetadata, uuid} from "./rule-fixtures";

interface Options {
  auth?: unknown;
  hashSecret?: string;
  values?: unknown[];
}

function compile(rule: string, {auth, hashSecret, values = []}: Options = {}) {
  const {sql} = compileRule(
    rule,
    {bucket: ruleBucket, metadata: ruleMetadata, auth, hashSecret, table: "t"},
    values
  );
  return {sql, values};
}

describe("compileRule", () => {
  describe("constants", () => {
    it.each([
      ["true==true", "TRUE"],
      ["true == false", "FALSE"],
      ["1 < 2", "TRUE"],
      ["'a' != 'a'", "FALSE"],
      ["null == null", "TRUE"],
      ["1 == '1'", "FALSE"],
      ["2 * 3 == 6", "TRUE"],
      ["7 % 4 == 3", "TRUE"],
      ["true && false", "FALSE"],
      ["false || true", "TRUE"],
      ["!(1 == 2)", "TRUE"],
      ["true ? 1 == 1 : 1 == 2", "TRUE"]
    ])("should fold %s to %s", (rule, sql) => {
      expect(compile(rule)).toEqual({sql, values: []});
    });

    it("should fold arithmetic with auth values", () => {
      expect(compile("1 / 4 == auth.quarter", {auth: {quarter: 0.25}}).sql).toBe("TRUE");
    });

    it("should refuse a decimal literal until the parser reads it correctly", () => {
      expect(() => compile("document.age > 2.5")).toThrow("not read correctly");
    });

    it("should fold auth values at compile time", () => {
      expect(compile("auth.role == 'admin'", {auth: {role: "admin"}}).sql).toBe("TRUE");
      expect(compile("auth.role == 'admin'", {auth: {role: "user"}}).sql).toBe("FALSE");
      expect(compile("auth.role == 'admin'").sql).toBe("FALSE");
      expect(compile("auth.team.name == 'a'", {auth: {team: {name: "a"}}}).sql).toBe("TRUE");
    });

    it("should compare dates by their time", () => {
      expect(compile("auth.a == auth.b", {auth: {a: new Date(5), b: new Date(5)}}).sql).toBe(
        "TRUE"
      );
    });

    it("should refuse to order unlike constants", () => {
      expect(() => compile("1 < 'a'")).toThrow(UnsupportedRuleError);
    });

    it("should refuse a constant division by zero", () => {
      expect(() => compile("1 / 0 == 1")).toThrow(InvalidRuleError);
    });
  });

  describe("comparisons with a field", () => {
    it("should bind the value next to the field with the field's type", () => {
      expect(compile("document.title == 'x'")).toEqual({
        sql: '"t"."title" = $1::text',
        values: ["x"]
      });
    });

    it("should keep the order of the operands", () => {
      expect(compile("'x' == document.title").sql).toBe('$1::text = "t"."title"');
      expect(compile("24 < document.age").sql).toBe('$1::bigint < "t"."age"');
    });

    it("should be true for a missing value on !=, like MongoDB", () => {
      expect(compile("document.title != 'x'")).toEqual({
        sql: '"t"."title" IS DISTINCT FROM $1::text',
        values: ["x"]
      });
    });

    it("should turn a comparison with null into IS NULL", () => {
      expect(compile("document.title == null").sql).toBe('"t"."title" IS NULL');
      expect(compile("document.title != null").sql).toBe('"t"."title" IS NOT NULL');
      expect(compile("null == document.title").sql).toBe('"t"."title" IS NULL');
    });

    it("should treat a missing auth value as null", () => {
      expect(compile("document.owner == auth._id", {auth: {}}).sql).toBe('"t"."owner" IS NULL');
    });

    it("should compare with a uuid from auth and lowercase it", () => {
      expect(compile("document.owner == auth._id", {auth: {_id: uuid.toUpperCase()}})).toEqual({
        sql: '"t"."owner" = $1::uuid',
        values: [uuid]
      });
    });

    it("should decide == and != itself when the value cannot be of the field's type", () => {
      expect(compile("document.owner == auth._id", {auth: {_id: "nope"}}).sql).toBe("FALSE");
      expect(compile("document.owner != auth._id", {auth: {_id: "nope"}}).sql).toBe("TRUE");
      expect(compile("document.count == 'five'").sql).toBe("FALSE");
      expect(compile("document.active != 1").sql).toBe("TRUE");
    });

    it("should refuse to order a field against a value of another type", () => {
      expect(() => compile("document.count > 'five'")).toThrow(UnsupportedRuleError);
      expect(() => compile("document.count > null")).toThrow(UnsupportedRuleError);
    });

    it.each([
      ["document.age > 24", '"t"."age" > $1::bigint', [24]],
      ["document.age >= auth.min", '"t"."age" >= $1::double precision', [2.5]],
      ["document.count < 3", '"t"."count" < $1::bigint', [3]],
      ["document.count <= 3", '"t"."count" <= $1::bigint', [3]],
      ["document.big == '9007199254740993'", '"t"."big" = $1::bigint', ["9007199254740993"]],
      ["document.active == true", '"t"."active" = $1::boolean', [true]],
      ["document.address.city == 'Ankara'", '"t"."address__city" = $1::text', ["Ankara"]],
      ["document.author == auth.x", '"t"."author" = $1::uuid', [uuid]]
    ])("should compile %s", (rule, sql, values) => {
      expect(compile(rule, {auth: {x: uuid, min: 2.5}})).toEqual({sql, values});
    });

    it("should convert a date string literal to a date", () => {
      expect(compile("document.created > '2024-05-01T00:00:00.000Z'")).toEqual({
        sql: '"t"."created" > $1::timestamptz',
        values: [new Date("2024-05-01T00:00:00.000Z")]
      });
    });

    it("should refuse a string literal that is not a date for a date field", () => {
      expect(() => compile("document.created == 'yesterday'")).toThrow(UnsupportedRuleError);
    });

    it("should not convert a date string that comes from auth", () => {
      expect(compile("document.created == auth.d", {auth: {d: "2024-05-01"}}).sql).toBe("FALSE");
      expect(compile("document.created == auth.d", {auth: {d: new Date(1)}}).sql).toBe(
        '"t"."created" = $1::timestamptz'
      );
    });

    it("should hash a string literal for a hash field when a secret is set", () => {
      expect(compile("document.password == 'p'", {hashSecret: "s"})).toEqual({
        sql: '"t"."password" = $1::text',
        values: [hash("p", "s")]
      });
      expect(compile("document.password == 'p'").values).toEqual(["p"]);
    });

    it("should not hash a value that comes from auth", () => {
      expect(
        compile("document.password == auth.p", {hashSecret: "s", auth: {p: "p"}}).values
      ).toEqual(["p"]);
    });
  });

  describe("comparisons between fields", () => {
    it("should be null safe on ==", () => {
      expect(compile("document.title == document.title").sql).toBe(
        '"t"."title" IS NOT DISTINCT FROM "t"."title"'
      );
      expect(compile("document.age != document.count").sql).toBe(
        '"t"."age" IS DISTINCT FROM "t"."count"'
      );
    });

    it("should compare numbers of different widths natively", () => {
      expect(compile("document.big > document.count").sql).toBe('"t"."big" > "t"."count"');
    });

    it("should compare a uuid with text as text", () => {
      expect(compile("document.owner == document.title").sql).toBe(
        '"t"."owner"::text IS NOT DISTINCT FROM "t"."title"::text'
      );
    });

    it("should decide == and != itself for unlike types", () => {
      expect(compile("document.age == document.title").sql).toBe("FALSE");
      expect(compile("document.age != document.title").sql).toBe("TRUE");
      expect(() => compile("document.age > document.title")).toThrow(UnsupportedRuleError);
    });
  });

  describe("logic", () => {
    it("should join comparisons with AND and OR", () => {
      expect(compile("document.count >= 1 && document.count < 10")).toEqual({
        sql: '("t"."count" >= $1::bigint AND "t"."count" < $2::bigint)',
        values: [1, 10]
      });
      expect(compile("document.title == 'a' || document.title == 'b'").sql).toBe(
        '("t"."title" = $1::text OR "t"."title" = $2::text)'
      );
    });

    it("should drop a side that folding makes irrelevant, with its values", () => {
      expect(compile("document.title == 'a' && true")).toEqual({
        sql: '"t"."title" = $1::text',
        values: ["a"]
      });
      expect(compile("document.title == 'a' || true")).toEqual({sql: "TRUE", values: []});
      expect(compile("false && document.title == 'a'")).toEqual({sql: "FALSE", values: []});
      expect(compile("document.title == 'a' || auth.admin", {auth: {admin: true}})).toEqual({
        sql: "TRUE",
        values: []
      });
      expect(
        compile("document.owner == auth._id || auth.role == 'admin'", {
          auth: {_id: uuid, role: "user"}
        })
      ).toEqual({sql: '"t"."owner" = $1::uuid', values: [uuid]});
    });

    it("should number placeholders after the values already in use", () => {
      expect(compile("document.title == 'a'", {values: ["x", "y"]})).toEqual({
        sql: '"t"."title" = $3::text',
        values: ["x", "y", "a"]
      });
    });

    it("should write literals when the values are inlined", () => {
      const compiled = compile('document.title == "it\'s"', {values: new InlineValues()});
      expect(compiled.sql).toBe(`"t"."title" = 'it''s'::text`);
    });

    it("should negate a comparison without losing the rows where the field is null", () => {
      expect(compile("!(document.age > 24)").sql).toBe(
        'NOT (COALESCE("t"."age" > $1::bigint, FALSE))'
      );
    });

    it("should not wrap a negated value that is never null", () => {
      expect(compile("!(document.title != 'a')").sql).toBe(
        'NOT ("t"."title" IS DISTINCT FROM $1::text)'
      );
    });

    it("should treat a boolean field as a condition", () => {
      expect(compile("document.active").sql).toBe('"t"."active" IS TRUE');
      expect(compile("document.active && document.count > 1").sql).toBe(
        '("t"."active" IS TRUE AND "t"."count" > $1::bigint)'
      );
      expect(compile("!(document.active == true)").sql).toBe(
        'NOT (COALESCE("t"."active" = $1::boolean, FALSE))'
      );
    });

    it("should refuse ! in front of a bare path, like MongoDB", () => {
      expect(() => compile("!document.active")).toThrow(InvalidRuleError);
      expect(() => compile("!(document.active)")).toThrow(InvalidRuleError);
    });

    it("should refuse a value that is not a condition", () => {
      expect(() => compile("document.title")).toThrow(InvalidRuleError);
      expect(() => compile("1")).toThrow(InvalidRuleError);
    });

    it("should compile the conditional operator to CASE", () => {
      expect(compile("document.count > 1 ? document.active : document.title == 'a'")).toEqual({
        sql: 'CASE WHEN "t"."count" > $1::bigint THEN "t"."active" IS TRUE ELSE "t"."title" = $2::text END',
        values: [1, "a"]
      });
    });

    it("should pick a branch of the conditional operator when its test is known", () => {
      expect(compile("auth.admin ? document.active : false", {auth: {admin: true}}).sql).toBe(
        '"t"."active" IS TRUE'
      );
      expect(compile("auth.admin ? document.active : false", {auth: {admin: false}}).sql).toBe(
        "FALSE"
      );
    });
  });

  describe("arithmetic", () => {
    it("should add whole numbers as bigint", () => {
      expect(compile("document.count + 1 > document.big")).toEqual({
        sql: '("t"."count"::bigint + $1::bigint) > "t"."big"',
        values: [1]
      });
    });

    it("should use double precision as soon as a side is not whole", () => {
      expect(compile("document.age * 2 > 10")).toEqual({
        sql: '("t"."age"::double precision * $1::double precision) > $2::bigint',
        values: [2, 10]
      });
    });

    it("should divide as double precision and guard the divisor", () => {
      expect(compile("document.count / 2 > 1").sql).toBe(
        '("t"."count"::double precision / NULLIF($1::double precision, 0)) > $2::bigint'
      );
    });

    it("should take the remainder of whole numbers and of fractions", () => {
      expect(compile("document.count % 2 == 0").sql).toBe(
        '("t"."count"::bigint % NULLIF($1::bigint, 0)) = $2::bigint'
      );
      expect(compile("document.age % 2 == 0").sql).toBe(
        'mod("t"."age"::double precision::numeric, NULLIF($1::double precision, 0)::numeric)::double precision = $2::bigint'
      );
    });

    it("should refuse arithmetic on text", () => {
      expect(() => compile("document.title + 'a' == 'b'")).toThrow(UnsupportedRuleError);
      expect(() => compile("document.count + 'a' == 1")).toThrow(UnsupportedRuleError);
    });
  });

  describe("fields", () => {
    it("should resolve a field under an unknown root as a document field, like MongoDB", () => {
      expect(compile("title == 'x'").sql).toBe('"t"."title" = $1::text');
    });

    it("should qualify columns with the table name when no alias is given", () => {
      const {sql} = compileRule(
        "document.title == 'x'",
        {bucket: ruleBucket, metadata: ruleMetadata, auth: {}},
        []
      );
      expect(sql).toBe(`"bucket_${bucketId}"."title" = $1::text`);
    });

    it("should refuse a field that is not in the bucket", () => {
      expect(() => compile("document.nope == 1")).toThrow(InvalidRuleError);
      expect(() => compile("document.address.nope == 1")).toThrow(InvalidRuleError);
    });

    it("should refuse a bare document or auth", () => {
      expect(() => compile("document == 1")).toThrow(InvalidRuleError);
      expect(() => compile("auth == 1")).toThrow(InvalidRuleError);
    });

    // [part9-encrypted] Pins the refusal of encrypted fields in rules. Remove or rewrite when Part 9 lands a comparable hash (docs/postgresql/09-writes.md).
    it.each(["document.secret == 'x'", "document.tags == 'x'", "document.author.id == 'x'"])(
      "should refuse %s as unsupported",
      rule => {
        expect(() => compile(rule)).toThrow(UnsupportedRuleError);
      }
    );

    it("should refuse to compare a json field", () => {
      expect(() => compile("document.note == 'x'")).toThrow(UnsupportedRuleError);
    });

    it("should refuse an auth value that is not a single value", () => {
      expect(() => compile("document.title == auth.roles", {auth: {roles: ["a"]}})).toThrow(
        UnsupportedRuleError
      );
    });

    it("should read bigint auth values as numbers in text form", () => {
      expect(compile("document.big == auth.n", {auth: {n: 12n}}).values).toEqual(["12"]);
    });
  });

  describe("unsupported syntax", () => {
    it.each([
      "document.title in 'a'",
      "document.tags[0] == 'a'",
      "-1 < document.age",
      "b'x' == document.title"
    ])("should refuse %s", rule => {
      expect(() => compile(rule)).toThrow(RuleCompileError);
    });

    it("should refuse a list used as a value", () => {
      expect(() => compile("document.tags == 'a'")).toThrow('"tags" is a list');
    });

    it("should report a syntax error as an invalid rule", () => {
      expect(() => compile("document.owner ==")).toThrow(InvalidRuleError);
    });
  });
});
