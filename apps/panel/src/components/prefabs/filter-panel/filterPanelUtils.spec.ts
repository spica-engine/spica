import {describe, it, expect} from "@jest/globals";
import {combineFilters, conditionsToExpression} from "./filterPanelUtils";
import type {FilterConditionRow, FilterField} from "./types";

const fields: FilterField[] = [
  {key: "title", label: "Title", type: "string"},
  {key: "age", label: "Age", type: "number"},
  {key: "created", label: "Created", type: "date"},
  {key: "active", label: "Active", type: "boolean"},
  {
    key: "status",
    label: "Status",
    type: "enum",
    enumOptions: [
      {label: "open", value: "open"},
      {label: "one", value: 1}
    ]
  },
  {key: "id", label: "ID", type: "id"},
  {key: "author", label: "Author", type: "relation", relationBucketId: "authors"},
  {key: "address.city", label: "City", type: "string"}
];

let counter = 0;
const row = (
  field: string,
  operator: string,
  value = "",
  logicalOp: "AND" | "OR" = "AND"
): FilterConditionRow => ({id: String(counter++), field, operator, value, logicalOp});

const expression = (...conditions: FilterConditionRow[]) =>
  conditionsToExpression(conditions, fields);

describe("conditionsToExpression", () => {
  it.each([
    [row("title", "equals", "a"), `(document.title == "a")`],
    [row("title", "not equals", "a"), `(document.title != "a")`],
    [row("title", "contains", "a.b"), `(regex(document.title, "a\\\\.b", "i"))`],
    [row("title", "starts with", "a"), `(regex(document.title, "^a", "i"))`],
    [row("title", "ends with", "a"), `(regex(document.title, "a$", "i"))`],
    [row("title", "is empty"), `((!(has(document.title)) || document.title == ""))`],
    [row("title", "is not empty"), `((has(document.title) && document.title != ""))`],
    [row("age", "equals", "5"), `(document.age == 5)`],
    [row("age", "greater than", "5"), `(document.age > 5)`],
    [row("age", "greater than or equal", "5"), `(document.age >= 5)`],
    [row("age", "less than", "5"), `(document.age < 5)`],
    [row("age", "less than or equal", "5"), `(document.age <= 5)`],
    [row("created", "before", "2024-01-01"), `(document.created < "2024-01-01")`],
    [row("created", "on or after", "2024-01-01"), `(document.created >= "2024-01-01")`],
    [row("created", "is empty"), `(!(has(document.created)))`],
    [row("active", "is", "true"), `(document.active == true)`],
    [row("active", "is", "false"), `(document.active == false)`],
    [row("status", "equals", "open"), `(document.status == "open")`],
    [row("status", "equals", "1"), `(document.status == 1)`],
    [row("id", "equals", "abc"), `(document.id == "abc")`],
    [row("author", "in", "a, b"), `(document.author in ["a", "b"])`],
    [row("author", "not in", "a"), `(!(document.author in ["a"]))`],
    [row("address.city", "equals", "Rome"), `(document.address.city == "Rome")`]
  ])("should write %j", (condition, expected) => {
    expect(expression(condition)).toBe(expected);
  });

  it("should write a value as a quoted string that cannot end early", () => {
    expect(expression(row("title", "equals", `a" || true || "b`))).toBe(
      `(document.title == "a\\" || true || \\"b")`
    );
    expect(expression(row("title", "equals", "line\nbreak\\"))).toBe(
      `(document.title == "line\\nbreak\\\\")`
    );
  });

  it("should leave out what cannot be written", () => {
    expect(expression(row("age", "equals", "abc"))).toBeNull();
    expect(expression(row("age", "greater than", "abc"))).toBeNull();
    expect(expression(row("author", "in", " , "))).toBeNull();
    expect(expression(row("nope", "equals", "a"))).toBeNull();
    expect(expression(row("title", "equals", ""))).toBeNull();
    expect(expression(row("title", "unknown", "a"))).toBeNull();
    expect(conditionsToExpression([], fields)).toBeNull();
  });

  it("should refuse a field name that is not a plain path", () => {
    const odd: FilterField[] = [{key: 'a" || true', label: "x", type: "string"}];
    expect(conditionsToExpression([row('a" || true', "equals", "a")], odd)).toBeNull();
  });

  it("should join conditions with AND or OR", () => {
    expect(expression(row("title", "equals", "a"), row("age", "equals", "1"))).toBe(
      `((document.title == "a") && (document.age == 1))`
    );
    expect(expression(row("title", "equals", "a"), row("age", "equals", "1", "OR"))).toBe(
      `((document.title == "a") || (document.age == 1))`
    );
  });

  it("should group mixed operators as the MongoDB filter does", () => {
    expect(
      expression(
        row("title", "equals", "a"),
        row("age", "equals", "1", "AND"),
        row("age", "equals", "2", "OR"),
        row("age", "equals", "3", "OR")
      )
    ).toBe(
      `(((document.title == "a") && (document.age == 1)) && ((document.age == 2) || (document.age == 3)))`
    );
  });

  it("should skip conditions that are not active", () => {
    expect(expression(row("title", "equals", ""), row("age", "equals", "1"))).toBe(
      `(document.age == 1)`
    );
  });
});

describe("combineFilters", () => {
  it("should return a single filter as it is, or nothing", () => {
    expect(combineFilters([null, undefined])).toBeUndefined();
    expect(combineFilters([null, {a: 1}])).toEqual({a: 1});
    expect(combineFilters(["a == 1", undefined])).toBe("a == 1");
  });

  it("should join objects with $and and expressions with &&", () => {
    expect(combineFilters([{a: 1}, {b: 2}])).toEqual({$and: [{a: 1}, {b: 2}]});
    expect(combineFilters(["a == 1", "b == 2"])).toBe("(a == 1) && (b == 2)");
  });
});
