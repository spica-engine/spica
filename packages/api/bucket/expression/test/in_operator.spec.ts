import {aggregate, run} from "../src/index";

describe("in operator", () => {
  describe("aggregation", () => {
    it("should match a field against a list", () => {
      expect(aggregate(`document.status in ["open", "done"]`, {}, "match")).toEqual({
        $expr: {$in: ["$status", ["open", "done"]]}
      });
    });

    it("should leave the expression bare when projecting", () => {
      expect(aggregate(`document.age in [1, 2]`, {}, "project")).toEqual({
        $in: ["$age", [1, 2]]
      });
    });

    it("should combine with other conditions", () => {
      expect(aggregate(`document.age in [1] && document.title == "a"`, {}, "match")).toEqual({
        $and: [{$expr: {$in: ["$age", [1]]}}, {$expr: {$eq: ["$title", "a"]}}]
      });
    });

    it("should refuse a right side that is not a list", () => {
      expect(() => aggregate(`document.status in document.tags`, {}, "match")).toThrow(
        "The right side of 'in' must be a list"
      );
      expect(() => aggregate(`document.status in "open"`, {}, "match")).toThrow(TypeError);
    });
  });

  describe("evaluation", () => {
    const context = {document: {status: "open", age: 2, created: new Date(5000)}};

    it("should tell whether the value is in the list", () => {
      expect(run(`document.status in ["open", "done"]`, context, "match")).toBe(true);
      expect(run(`document.status in ["done"]`, context, "match")).toBe(false);
      expect(run(`document.age in [1, 2]`, context, "match")).toBe(true);
      expect(run(`document.age in []`, context, "match")).toBe(false);
    });

    it("should refuse a right side that is not a list", () => {
      expect(() => run(`document.status in "open"`, context, "match")).toThrow(TypeError);
    });
  });
});
