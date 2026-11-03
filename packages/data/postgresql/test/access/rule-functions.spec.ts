import {compileRule, InvalidRuleError, UnsupportedRuleError} from "@spica-server/data-postgresql";
import {InlineValues} from "@spica-server/data-postgresql-orm";
import {ruleBucket, ruleMetadata, uuid} from "./rule-fixtures";

const NOW = 1_700_000_000_500;

function compile(rule: string, auth: unknown = {}, values: unknown[] = []) {
  const {sql} = compileRule(
    rule,
    {bucket: ruleBucket, metadata: ruleMetadata, auth, table: "t", now: () => NOW},
    values
  );
  return {sql, values};
}

const tableOf = (path: string) =>
  ruleMetadata.tables.find(table => table.path.join(".") == path)!.name;

const rows = (path: string, alias = "_a1") =>
  `FROM "${tableOf(path)}" AS "${alias}" WHERE "${alias}"."_parent" = "t"."id"`;

describe("built-in functions", () => {
  describe("has", () => {
    it("should test a column for NULL", () => {
      expect(compile("has(document.title)")).toEqual({
        sql: '"t"."title" IS NOT NULL',
        values: []
      });
      expect(compile("has(document.address.city)").sql).toBe('"t"."address__city" IS NOT NULL');
      expect(compile("has(document.author)").sql).toBe('"t"."author" IS NOT NULL');
    });

    it("should ask a list for rows", () => {
      expect(compile("has(document.tags)").sql).toBe(`EXISTS (SELECT 1 ${rows("tags")})`);
    });

    it("should fold a value from auth", () => {
      expect(compile("has(auth.role)", {role: "x"}).sql).toBe("TRUE");
      expect(compile("has(auth.role)", {}).sql).toBe("FALSE");
    });

    it("should be usable under !", () => {
      expect(compile("!(has(document.title))").sql).toBe('NOT ("t"."title" IS NOT NULL)');
    });

    it("should refuse an object, which is not a single column", () => {
      expect(() => compile("has(document.address)")).toThrow(UnsupportedRuleError);
    });
  });

  describe("unixTime and now", () => {
    it("should take the epoch of a date column", () => {
      expect(compile("unixTime(document.created) > 100")).toEqual({
        sql: 'EXTRACT(EPOCH FROM "t"."created")::double precision > $1::bigint',
        values: [100]
      });
    });

    it("should read now as seconds, fixed when the rule is compiled", () => {
      expect(compile("unixTime(document.created) < now()")).toEqual({
        sql: 'EXTRACT(EPOCH FROM "t"."created")::double precision < $1::double precision',
        values: [1_700_000_000.5]
      });
    });

    it("should fold a date from auth", () => {
      expect(compile("unixTime(auth.at) == 5", {at: new Date(5000)}).sql).toBe("TRUE");
    });

    it("should refuse anything but a date", () => {
      expect(() => compile("unixTime(document.title) > 1")).toThrow(UnsupportedRuleError);
      expect(() => compile("unixTime(auth.at) > 1", {at: "nope"})).toThrow(InvalidRuleError);
    });
  });

  describe("length", () => {
    it("should count the rows of a list", () => {
      expect(compile("length(document.tags) > 2")).toEqual({
        sql: `(SELECT COUNT(*) ${rows("tags")}) > $1::bigint`,
        values: [2]
      });
    });

    it("should measure text and json lists", () => {
      expect(compile("length(document.title) > 3").sql).toBe(
        'char_length("t"."title") > $1::bigint'
      );
      expect(compile("length(document.note) > 3").sql).toBe(
        `CASE WHEN jsonb_typeof("t"."note") = 'array' THEN jsonb_array_length("t"."note") END > $1::bigint`
      );
    });

    it("should fold a literal list and a list from auth", () => {
      expect(compile("length([1, 2, 3]) == 3").sql).toBe("TRUE");
      expect(compile("length(auth.roles) == 2", {roles: ["a", "b"]}).sql).toBe("TRUE");
      expect(compile("length(auth.roles) == 0", {}).sql).toBe("TRUE");
    });

    it("should refuse a field that is neither text nor a list", () => {
      expect(() => compile("length(document.age) > 1")).toThrow(UnsupportedRuleError);
    });
  });

  describe("regex", () => {
    it("should match with ~ and bind the pattern", () => {
      expect(compile('regex(document.title, "^al")')).toEqual({
        sql: '"t"."title" ~ $1::text',
        values: ["^al"]
      });
    });

    it("should ignore case for the i flag", () => {
      expect(compile('regex(document.title, "^al", "i")').sql).toBe('"t"."title" ~* $1::text');
    });

    it("should read a uuid as text", () => {
      expect(compile('regex(document.owner, "^0192")').sql).toBe('"t"."owner"::text ~ $1::text');
    });

    it("should be false for NULL even under !", () => {
      expect(compile('!(regex(document.title, "^al"))').sql).toBe(
        'NOT (COALESCE("t"."title" ~ $1::text, FALSE))'
      );
    });

    it.each([
      ['regex(document.title, "(?<=a)b")', "lookbehind"],
      ['regex(document.title, "(?<name>a)")', "named groups"],
      ['regex(document.title, "\\\\p{L}")', "unicode properties"],
      ['regex(document.title, "a", "m")', 'flag "m"'],
      ['regex(document.title, "a", "is")', 'flag "s"']
    ])("should refuse %s", (rule, reason) => {
      expect(() => compile(rule)).toThrow(UnsupportedRuleError);
      expect(() => compile(rule)).toThrow(reason);
    });

    it("should refuse a field that is not text", () => {
      expect(() => compile('regex(document.age, "1")')).toThrow(UnsupportedRuleError);
    });

    it("should check its arguments like the MongoDB form", () => {
      expect(() => compile("regex(document.title)")).toThrow(
        "Function 'regex' accepts minimum 2 argument(s) but found 1."
      );
      expect(() => compile('regex(document.title, "a", "i", "x")')).toThrow(
        "Function 'regex' accepts maximum 3 argument(s) but found 4."
      );
      expect(() => compile('regex("a", "a")')).toThrow(
        "Function 'regex' arg[0] must be property access chain."
      );
      expect(() => compile("regex(document.title, document.title)")).toThrow(
        "Function 'regex' arg[1] must be literal."
      );
    });
  });

  describe("some, every and equal", () => {
    const tags = (name: string) => `${name}(document.tags, ['a', 'b'])`;

    it("should look for any of the values with EXISTS", () => {
      expect(compile(tags("some"))).toEqual({
        sql: `EXISTS (SELECT 1 ${rows("tags")} AND "_a1"."_value" = ANY($1::text[]))`,
        values: [["a", "b"]]
      });
    });

    it("should require all of the values with <@", () => {
      expect(compile(tags("every"))).toEqual({
        sql: `$1::text[] <@ ARRAY(SELECT "_a1"."_value" ${rows("tags")})`,
        values: [["a", "b"]]
      });
    });

    it("should require the list to hold exactly the values", () => {
      expect(compile(tags("equal"))).toEqual({
        sql: `(SELECT COUNT(*) = 2 AND COALESCE(BOOL_AND("_a1"."_value" = ANY($1::text[])), TRUE) ${rows("tags")})`,
        values: [["a", "b"]]
      });
    });

    it("should give every use its own alias", () => {
      expect(compile("some(document.tags, ['a']) && every(document.tags, ['b'])").sql).toBe(
        `(EXISTS (SELECT 1 ${rows("tags", "_a1")} AND "_a1"."_value" = ANY($1::text[])) AND $2::text[] <@ ARRAY(SELECT "_a2"."_value" ${rows("tags", "_a2")}))`
      );
    });

    it("should take the values from a list in auth", () => {
      expect(compile("some(document.tags, auth.roles)", {roles: ["x"]})).toEqual({
        sql: `EXISTS (SELECT 1 ${rows("tags")} AND "_a1"."_value" = ANY($1::text[]))`,
        values: [["x"]]
      });
    });

    it("should accept auth values inside the written list", () => {
      expect(compile("some(document.tags, [auth.role, 'b'])", {role: "r"}).sql).toContain(
        "ANY($1::text[])"
      );
      expect(compile("some(document.tags, [auth.role, 'b'])", {role: "r"}).values).toEqual([
        ["r", "b"]
      ]);
    });

    it("should type the list by the element: numbers", () => {
      expect(compile("some(document.scores, [1, 2])")).toEqual({
        sql: `EXISTS (SELECT 1 ${rows("scores")} AND "_a1"."_value" = ANY($1::integer[]))`,
        values: [[1, 2]]
      });
    });

    it("should type the list by the element: related ids", () => {
      expect(compile("some(document.editors, [auth._id])", {_id: uuid.toUpperCase()})).toEqual({
        sql: `EXISTS (SELECT 1 ${rows("editors")} AND "_a1"."_target" = ANY($1::uuid[]))`,
        values: [[uuid]]
      });
    });

    it("should compare json elements as json", () => {
      expect(compile("some(document.docs, [[1, 2], 'x'])")).toEqual({
        sql: `EXISTS (SELECT 1 ${rows("docs")} AND "_a1"."_value" = ANY($1::jsonb[]))`,
        values: [["[1,2]", '"x"']]
      });
    });

    it("should drop values the elements cannot hold", () => {
      expect(compile("some(document.scores, [1, 'x', 3000000000])").values).toEqual([[1]]);
      expect(compile("some(document.scores, ['x'])").sql).toBe("FALSE");
      expect(compile("every(document.scores, [1, 'x'])").sql).toBe("FALSE");
      expect(compile("equal(document.scores, [1, 'x'])").sql).toContain("= 2 AND");
    });

    it("should decide empty lists", () => {
      expect(compile("some(document.tags, [])").sql).toBe("FALSE");
      expect(compile("every(document.tags, [])").sql).toBe("TRUE");
      expect(compile("equal(document.tags, [])").sql).toContain("COUNT(*) = 0");
    });

    it("should write the list as ARRAY[...] when the values are inlined", () => {
      expect(compile("some(document.tags, ['a', 'b'])", {}, new InlineValues()).sql).toBe(
        `EXISTS (SELECT 1 ${rows("tags")} AND "_a1"."_value" = ANY(ARRAY['a', 'b']::text[]))`
      );
    });

    it("should fold two lists that are known", () => {
      const auth = {roles: ["a", "b"]};
      expect(compile("some(auth.roles, ['b', 'z'])", auth).sql).toBe("TRUE");
      expect(compile("some(auth.roles, ['z'])", auth).sql).toBe("FALSE");
      expect(compile("every(auth.roles, ['a'])", auth).sql).toBe("TRUE");
      expect(compile("every(auth.roles, ['a', 'z'])", auth).sql).toBe("FALSE");
      expect(compile("equal(auth.roles, ['b', 'a'])", auth).sql).toBe("TRUE");
      expect(compile("equal(auth.roles, ['a'])", auth).sql).toBe("FALSE");
      expect(compile("some(['a'], ['a'])").sql).toBe("TRUE");
    });

    it("should refuse what the MongoDB form cannot do either, or cannot be done in SQL", () => {
      expect(() => compile("some(document.title, ['a'])")).toThrow(UnsupportedRuleError);
      expect(() => compile("some(document.tags, document.tags)")).toThrow(UnsupportedRuleError);
      expect(() => compile("some(document.tags, [document.title])")).toThrow(UnsupportedRuleError);
      expect(() => compile("some(document.lines, ['a'])")).toThrow(UnsupportedRuleError);
      expect(() => compile("has(document.label)")).toThrow(UnsupportedRuleError);
      expect(() => compile("some(document.tags, auth.role)", {role: "a"})).toThrow(
        InvalidRuleError
      );
    });

    it("should check its arguments like the MongoDB form", () => {
      expect(() => compile("some(document.tags)")).toThrow(
        "Function 'some' accepts exactly 2 argument(s) but found 1."
      );
      expect(() => compile("some('a', ['a'])")).toThrow(
        "Function 'some' arg[0] must be property access chain or array."
      );
    });
  });

  describe("unknown functions", () => {
    it("should be refused", () => {
      expect(() => compile("nope(document.title)")).toThrow("Function 'nope' does not exist.");
    });
  });
});
