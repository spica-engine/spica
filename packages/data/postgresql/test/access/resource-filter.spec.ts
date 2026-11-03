import {InvalidIdError} from "@spica-server/data";
import {InlineValues, ResolvedColumn} from "@spica-server/data-postgresql-orm";
import {keyParser, resourceFilterCondition} from "../../src/access/resource-filter";

const a = "0192f3a0-0000-7000-8000-00000000000a";
const b = "0192f3a0-0000-7000-8000-00000000000b";
const c = "0192f3a0-0000-7000-8000-00000000000c";

function render(
  filter: Parameters<typeof resourceFilterCondition>[0],
  type: ResolvedColumn["type"] = "uuid",
  parse = keyParser("uuid"),
  values: unknown[] = []
) {
  const sql = resourceFilterCondition(filter, parse).sql('"id"', {type} as ResolvedColumn, values);
  return {sql, values};
}

describe("resourceFilterCondition", () => {
  it("should allow every row without a filter", () => {
    expect(render(undefined)).toEqual({sql: "TRUE", values: []});
  });

  it("should allow every row when include and exclude are empty", () => {
    expect(render({include: [], exclude: []})).toEqual({sql: "TRUE", values: []});
  });

  it("should render include as = ANY with a bound array", () => {
    expect(render({include: [a, b], exclude: []})).toEqual({
      sql: '("id" = ANY($1::uuid[]))',
      values: [[a, b]]
    });
  });

  it("should render each exclude list as its own <> ALL alternative", () => {
    expect(render({include: [], exclude: [[a], [b, c]]})).toEqual({
      sql: '("id" <> ALL($1::uuid[]) OR "id" <> ALL($2::uuid[]))',
      values: [[a], [b, c]]
    });
  });

  it("should put include after the exclude alternatives", () => {
    expect(render({include: [c], exclude: [[a]]})).toEqual({
      sql: '("id" <> ALL($1::uuid[]) OR "id" = ANY($2::uuid[]))',
      values: [[a], [c]]
    });
  });

  it("should continue numbering after the placeholders already in use", () => {
    expect(render({include: [a], exclude: []}, "uuid", keyParser("uuid"), ["x", "y"])).toEqual({
      sql: '("id" = ANY($3::uuid[]))',
      values: ["x", "y", [a]]
    });
  });

  it("should drop duplicate ids, including ones that differ only by case", () => {
    expect(render({include: [a, a.toUpperCase()], exclude: [[b, b]]}).values).toEqual([[b], [a]]);
  });

  it("should keep an empty exclude list as an alternative that allows every row", () => {
    expect(render({include: [], exclude: [[]]})).toEqual({
      sql: '("id" <> ALL($1::uuid[]))',
      values: [[]]
    });
  });

  it("should write literals when the values are inlined", () => {
    expect(
      render({include: [a], exclude: [[b]]}, "uuid", keyParser("uuid"), new InlineValues())
    ).toEqual({
      sql: `("id" <> ALL(ARRAY['${b}']::uuid[]) OR "id" = ANY(ARRAY['${a}']::uuid[]))`,
      values: []
    });
  });

  it("should cast to the type of the key column", () => {
    expect(render({include: ["1", "2"], exclude: []}, "integer", keyParser("integer"))).toEqual({
      sql: '("id" = ANY($1::integer[]))',
      values: [[1, 2]]
    });
  });

  it("should reject ids its key type cannot parse before any SQL is built", () => {
    expect(() =>
      resourceFilterCondition({include: ["nope"], exclude: []}, keyParser("uuid"))
    ).toThrow(InvalidIdError);
    expect(() =>
      resourceFilterCondition({include: [], exclude: [[a, "nope"]]}, keyParser("uuid"))
    ).toThrow(InvalidIdError);
  });
});

describe("keyParser", () => {
  it("should lowercase uuids and reject anything else", () => {
    expect(keyParser("uuid")(a.toUpperCase())).toBe(a);
    expect(() => keyParser("uuid")("12")).toThrow(InvalidIdError);
  });

  it("should parse integers within the int4 range", () => {
    expect(keyParser("integer")("42")).toBe(42);
    expect(keyParser("integer")("-7")).toBe(-7);
    expect(keyParser("integer")("2147483647")).toBe(2147483647);
    expect(() => keyParser("integer")("2147483648")).toThrow(InvalidIdError);
    expect(() => keyParser("integer")("1.5")).toThrow(InvalidIdError);
    expect(() => keyParser("integer")("abc")).toThrow(InvalidIdError);
    expect(() => keyParser("integer")("")).toThrow(InvalidIdError);
  });

  it("should keep bigint as a normalized string and reject values outside int8", () => {
    expect(keyParser("bigint")("9223372036854775807")).toBe("9223372036854775807");
    expect(keyParser("bigint")("007")).toBe("7");
    expect(() => keyParser("bigint")("9223372036854775808")).toThrow(InvalidIdError);
    expect(() => keyParser("bigint")("1e3")).toThrow(InvalidIdError);
  });

  it("should accept any text key as it is", () => {
    expect(keyParser("text")("My Key/1")).toBe("My Key/1");
  });
});
