import {
  compileFilter,
  FILTER_LIMITS,
  InvalidRuleError,
  RuleCompileError
} from "@spica-server/data-postgresql";
import {
  bucketId,
  otherBucket,
  otherMetadata,
  otherId,
  ruleBucket,
  ruleMetadata
} from "./rule-fixtures";
import {expectSql} from "./sql";

const related = (id: string) =>
  id == otherId ? {bucket: otherBucket, metadata: otherMetadata} : undefined;

function compile(filter: string, values: unknown[] = []) {
  const {sql, joins} = compileFilter(
    filter,
    {bucket: ruleBucket, metadata: ruleMetadata, table: "t", related},
    values
  );
  return {sql, joins, values};
}

describe("compileFilter", () => {
  it("should bind every value", () => {
    const {sql, values} = compile(`document.title == "ann" && document.age > 3`);

    expectSql(sql, `("t"."title" = $1::text AND "t"."age" > $2::bigint)`);
    expect(values).toEqual(["ann", 3]);
  });

  it("should reach a related bucket through a join and nothing else", () => {
    const {sql, joins} = compile(`document.author.name == "ann"`);

    expect(sql).toMatch(/^"_r[0-9a-f]{12}"\."name" = \$1::text$/);
    expect(joins).toHaveLength(1);
    expect(joins[0]).toContain(`LEFT JOIN "bucket_${otherId}"`);
    expect(() => compile(`other.name == "ann"`)).toThrow(InvalidRuleError);
  });

  it("should refuse fields the bucket cannot filter on", () => {
    expect(() => compile(`document.nope == 1`)).toThrow(InvalidRuleError);
  });

  it("should compare an encrypted field through its hash column", () => {
    expect(compile(`document.secret == "x"`).sql).toBe('"t"."secret__hash" = $1::text');
    expect(compile(`document.author.secret == "x"`).sql).toMatch(
      /^"_r[0-9a-f]{12}"\."secret__hash" = \$1::text$/
    );
  });

  describe("auth", () => {
    it.each([
      `document.title == auth.name`,
      `has(auth.name)`,
      `auth.admin == true`,
      `some(document.tags, auth.roles)`
    ])("should refuse %s", filter => {
      expect(() => compile(filter)).toThrow('"auth" cannot be used in a filter.');
    });
  });

  describe("limits", () => {
    it("should refuse a filter that is too long", () => {
      const filter = `document.title == "${"a".repeat(FILTER_LIMITS.length)}"`;
      expect(() => compile(filter)).toThrow(/longer than/);
    });

    it("should refuse a filter that has too many terms", () => {
      const balanced = (count: number): string =>
        count == 1
          ? "document.age > 1"
          : `(${balanced(Math.ceil(count / 2))} || ${balanced(Math.floor(count / 2))})`;

      expect(() => compile(balanced(FILTER_LIMITS.terms))).toThrow(/more than \d+ terms/);
    });

    it("should refuse a flat chain once it is nested too deep, as the parser nests it", () => {
      const chain = Array.from({length: 40}, () => "document.age > 1").join(" || ");
      expect(() => compile(chain)).toThrow(/nested deeper than/);
    });

    it("should refuse a filter that is nested too deep", () => {
      const filter = `${"!(".repeat(FILTER_LIMITS.depth)}document.age > 1${")".repeat(FILTER_LIMITS.depth)}`;
      expect(() => compile(filter)).toThrow(RuleCompileError);
    });

    it("should count a comparison as one term, not the five nodes of `document.age == 1`", () => {
      const filter = Array.from({length: 25}, (_, index) => `document.age == ${index}`).join(
        " || "
      );
      expect(() => compile(filter)).not.toThrow();
    });

    it("should measure nesting in expressions, not in the hops between them", () => {
      const list = Array.from({length: 40}, (_, index) => `"v${index}"`).join(", ");
      expect(() => compile(`some(document.tags, [${list}])`)).not.toThrow();
    });

    it("should not count the values of a list as terms", () => {
      const values = Array.from({length: 100}, (_, index) => `"v${index}"`).join(", ");
      const {values: bound} = compile(`document.title in [${values}]`);

      expect(bound).toHaveLength(100);
    });

    it("should accept a filter inside the limits", () => {
      const filter = Array.from({length: 10}, (_, index) => `document.age > ${index}`).join(" || ");
      expect(() => compile(filter)).not.toThrow();
    });
  });

  describe("injection", () => {
    it.each([
      `document.title == "a"; DROP TABLE bucket_x`,
      `document.title == "a" -- comment`,
      `document.title == "a" /* comment */`,
      `document.title == 'a' OR 1=1`,
      `document.title == "a" OR "1"="1"`,
      `document.title::text == "a"`,
      `(SELECT 1)`,
      `document.title == (SELECT password FROM identities)`,
      `document.title == $1`,
      `document["title"] == "a"`,
      `document.title == "a") OR (1 == 1`,
      `pg_sleep(10)`,
      `document.title == pg_sleep(10)`,
      `document.pg_sleep(10)`,
      `1; SELECT 1`,
      ``,
      `   `
    ])("should refuse %j", filter => {
      expect(() => compile(filter)).toThrow(RuleCompileError);
    });

    it.each([
      `'; DROP TABLE bucket_x; --`,
      `" OR 1=1 --`,
      `\\'; SELECT 1; --`,
      `$1`,
      `’; DROP TABLE x`,
      `a\u0000b`
    ])("should bind %j as a value instead of reading it as SQL", text => {
      const {sql, values} = compile(`document.title == ${JSON.stringify(text)}`);

      expect(sql).toBe(`"t"."title" = $1::text`);
      expect(values).toEqual([text]);
    });
  });

  describe("fuzz", () => {
    const pool = [
      "document.title",
      "document.age",
      "document.tags",
      "document.author.name",
      "auth.name",
      `"x"`,
      `'y'`,
      `"'; DROP TABLE t; --"`,
      "1",
      "2.5",
      "true",
      "null",
      "==",
      "!=",
      "<",
      ">=",
      "&&",
      "||",
      "!",
      "(",
      ")",
      "[",
      "]",
      ",",
      "has",
      "some",
      "length",
      "regex",
      "in",
      "-",
      "+",
      ";",
      "--",
      "/*",
      "::",
      "$1",
      "SELECT"
    ];

    // mulberry32, so a failure names the same input on every run
    const random = (seed: number) => () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    it("should never put text from the filter into the SQL", () => {
      const next = random(20240607);
      let compiled = 0;

      for (let run = 0; run < 3000; run++) {
        const length = 1 + Math.floor(next() * 9);
        const filter = Array.from({length}, () => pool[Math.floor(next() * pool.length)]).join(
          next() < 0.5 ? " " : ""
        );
        try {
          const {sql} = compile(filter);
          compiled++;
          expect({filter, sql}).toEqual({
            filter,
            sql: expect.not.stringMatching(/['";]|--|\/\*|DROP/)
          });
        } catch (error) {
          expect({filter, error}).toEqual({filter, error: expect.any(RuleCompileError)});
        }
      }
      expect(compiled).toBeGreaterThan(0);
    });
  });
});
