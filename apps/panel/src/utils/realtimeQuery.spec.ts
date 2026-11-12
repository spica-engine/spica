import {describe, expect, it} from "@jest/globals";
import {realtimeFilter, realtimeSort} from "./realtimeQuery";

describe("realtimeSort", () => {
  it("sorts newest first by the bucket's key field", () => {
    expect(realtimeSort(undefined, "id")).toBe('{"id":-1}');
    expect(realtimeSort(undefined, "_id")).toBe('{"_id":-1}');
  });

  it("keeps a sort the caller chose", () => {
    expect(realtimeSort({title: 1}, "id")).toBe('{"title":1}');
  });
});

describe("realtimeFilter", () => {
  it("sends a MongoDB filter as JSON", () => {
    expect(realtimeFilter({title: "a"})).toBe('{"title":"a"}');
  });

  it("sends an expression filter as the raw string, not a quoted JSON string", () => {
    expect(realtimeFilter('document.title == "a"')).toBe('document.title == "a"');
  });

  it("sends nothing when there is no filter", () => {
    expect(realtimeFilter(undefined)).toBe("");
    expect(realtimeFilter("")).toBe("");
  });
});
