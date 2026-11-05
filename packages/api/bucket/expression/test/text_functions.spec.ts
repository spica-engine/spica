import {aggregate, run} from "../src/index";

describe("startsWith and contains", () => {
  describe("aggregation", () => {
    it("should match the start of a field", () => {
      expect(aggregate(`startsWith(document.title, "ann")`, {}, "match")).toEqual({
        $expr: {$eq: [{$regexMatch: {input: "$title", regex: "^ann"}}, true]}
      });
    });

    it("should match anywhere in a field", () => {
      expect(aggregate(`contains(document.title, "ann")`, {}, "project")).toEqual({
        $eq: [{$regexMatch: {input: "$title", regex: "ann"}}, true]
      });
    });

    it("should escape what a regular expression reads as syntax", () => {
      expect(aggregate(`contains(document.title, "a.b*(c)[d]\\\\")`, {}, "project")).toEqual({
        $eq: [{$regexMatch: {input: "$title", regex: "a\\.b\\*\\(c\\)\\[d\\]\\\\"}}, true]
      });
    });

    it("should refuse arguments of the wrong kind", () => {
      expect(() => aggregate(`startsWith(document.title)`, {}, "match")).toThrow(TypeError);
      expect(() => aggregate(`startsWith("a", "b")`, {}, "match")).toThrow(TypeError);
      expect(() => aggregate(`startsWith(document.title, document.name)`, {}, "match")).toThrow(
        TypeError
      );
      expect(() => aggregate(`startsWith(document.title, 1)`, {}, "match")).toThrow(
        "must be a string"
      );
    });
  });

  describe("evaluation", () => {
    const context = {document: {title: "Annabel", age: 3}};

    it("should compare the text literally", () => {
      expect(run(`startsWith(document.title, "Ann")`, context, "match")).toBe(true);
      expect(run(`startsWith(document.title, "ann")`, context, "match")).toBe(false);
      expect(run(`contains(document.title, "nab")`, context, "match")).toBe(true);
      expect(run(`contains(document.title, ".")`, context, "match")).toBe(false);
    });

    it("should not match a value that is not text", () => {
      expect(run(`contains(document.age, "3")`, context, "match")).toBe(false);
      expect(run(`startsWith(document.missing, "a")`, context, "match")).toBe(false);
    });
  });
});
