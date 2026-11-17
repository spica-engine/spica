import {BadRequestException} from "@nestjs/common";
import {compileFilterNode} from "@spica-server/data-postgresql";
import {FilterNode} from "@spica-server/interface-bucket-common";
import {expressionOf} from "../../src/query/bucket/where";
import {ruleBucket, ruleMetadata} from "../access/rule-fixtures";
import {expectSql} from "../access/sql";

const condition = (path: string[], operator: string, value: unknown) => ({path, operator, value});

function compile(node: FilterNode) {
  const values: unknown[] = [];
  const {sql} = compileFilterNode(
    expressionOf(node),
    {bucket: ruleBucket, metadata: ruleMetadata, table: "t"},
    values
  );
  return {sql, values};
}

describe("expressionOf", () => {
  it.each([
    ["eq", `"t"."title" = $1::text`],
    ["ne", `"t"."title" IS DISTINCT FROM $1::text`]
  ])("should write %s as a comparison with a bound value", (operator, sql) => {
    const compiled = compile(condition(["title"], operator, "a"));

    expectSql(compiled.sql, sql);
    expect(compiled.values).toEqual(["a"]);
  });

  it("should write the ordering operators", () => {
    expect(compile(condition(["age"], "gt", 5)).sql).toBe(`"t"."age" > $1::bigint`);
    expect(compile(condition(["age"], "gte", 5)).sql).toContain(">=");
    expect(compile(condition(["age"], "lt", 5)).sql).toContain("<");
    expect(compile(condition(["age"], "lte", 5)).sql).toContain("<=");
  });

  it("should write in and nin over a list of values", () => {
    const included = compile(condition(["title"], "in", ["a", "b"]));
    expect(included.values).toEqual(["a", "b"]);
    expect(included.sql).toContain("OR");

    const excluded = compile(condition(["title"], "nin", ["a"]));
    expect(excluded.sql).toContain("NOT");
    expect(compile(condition(["title"], "in", [])).sql).toBe("FALSE");
  });

  it("should write regex as a pattern match", () => {
    const compiled = compile(condition(["title"], "regex", "^a"));

    expect(compiled.sql).toBe(`"t"."title" ~ $1::text`);
    expect(compiled.values).toEqual(["^a"]);
  });

  it("should reach a nested field and a date", () => {
    expect(compile(condition(["address", "city"], "eq", "Rome")).sql).toContain(
      `"t"."address__city"`
    );
    const compiled = compile(condition(["created"], "lt", new Date("2024-01-01T00:00:00Z")));
    expect(compiled.sql).toBe(`"t"."created" < $1::timestamptz`);
  });

  it("should combine groups", () => {
    const compiled = compile({
      or: [
        {and: [condition(["title"], "eq", "a"), condition(["age"], "gt", 1)]},
        condition(["title"], "eq", "b")
      ]
    });

    expectSql(
      compiled.sql,
      `(("t"."title" = $1::text AND "t"."age" > $2::bigint) OR "t"."title" = $3::text)`
    );
    expect(compiled.values).toEqual(["a", 1, "b"]);
  });

  it("should never write a value into the statement", () => {
    const compiled = compile(condition(["title"], "eq", "'; DROP TABLE t; --"));

    expect(compiled.sql).not.toMatch(/DROP|'|;/);
    expect(compiled.values).toEqual(["'; DROP TABLE t; --"]);
  });

  it.each([
    [condition(["title"], "exists", true)],
    [condition(["title"], "in", "a")],
    [condition(["title"], "regex", 1)],
    [condition(["title"], "eq", {a: 1})],
    [condition(["title"], "eq", ["a"])]
  ])("should answer 400 for %j", node => {
    expect(() => expressionOf(node)).toThrow(BadRequestException);
  });
});
