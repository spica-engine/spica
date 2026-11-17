import {describe, it, expect} from "@jest/globals";
import {
  allOf,
  anyOf,
  compileStorageClause,
  escapeRegex,
  matchesName,
  nameEndsWithSlash,
  type StorageClause
} from "./storageQuery";

const directory: StorageClause = anyOf([matchesName("^[^/]+$"), matchesName("^[^/]+/$")]);

describe("compileStorageClause", () => {
  it("should be null for no clause", () => {
    expect(compileStorageClause("mongodb", null)).toBeNull();
    expect(compileStorageClause("postgresql", allOf([]))).toBeNull();
  });

  describe("on MongoDB, and before the engine is known", () => {
    it.each(["mongodb", undefined] as const)("should write MongoDB JSON (%s)", engine => {
      expect(compileStorageClause(engine, directory)).toEqual({
        $or: [{name: {$regex: "^[^/]+$"}}, {name: {$regex: "^[^/]+/$"}}]
      });
    });

    it("should write case-insensitive and negated matches, lists and ranges", () => {
      expect(compileStorageClause("mongodb", matchesName("a.b", true))).toEqual({
        name: {$regex: "a.b", $options: "i"}
      });
      expect(compileStorageClause("mongodb", nameEndsWithSlash())).toEqual({
        name: {$not: {$regex: "/$"}}
      });
      expect(
        compileStorageClause("mongodb", {kind: "in", field: "content.type", values: ["a", "b"]})
      ).toEqual({"content.type": {$in: ["a", "b"]}});
      expect(
        compileStorageClause("mongodb", {kind: "equals", field: "content.type", value: "x"})
      ).toEqual({"content.type": "x"});
      expect(
        compileStorageClause("mongodb", {kind: "notEqual", field: "content.type", value: "x"})
      ).toEqual({"content.type": {$ne: "x"}});
      expect(
        compileStorageClause("mongodb", {kind: "range", field: "content.size", gte: 1, lte: 5})
      ).toEqual({"content.size": {$gte: 1, $lte: 5}});
      expect(
        compileStorageClause("mongodb", {kind: "range", field: "created_at", lte: "2026-01-01"})
      ).toEqual({created_at: {$lte: "2026-01-01"}});
    });

    it("should join clauses with $and, and not wrap a single one", () => {
      expect(compileStorageClause("mongodb", allOf([matchesName("a"), matchesName("b")]))).toEqual({
        $and: [{name: {$regex: "a"}}, {name: {$regex: "b"}}]
      });
      expect(compileStorageClause("mongodb", allOf([matchesName("a")]))).toEqual({
        name: {$regex: "a"}
      });
    });
  });

  describe("on PostgreSQL", () => {
    it("should write the expression language", () => {
      expect(compileStorageClause("postgresql", directory)).toBe(
        '(regex(document.name, "^[^/]+$") || regex(document.name, "^[^/]+/$"))'
      );
      expect(compileStorageClause("postgresql", matchesName("a.b", true))).toBe(
        'regex(document.name, "a.b", "i")'
      );
      expect(compileStorageClause("postgresql", nameEndsWithSlash())).toBe(
        '!(regex(document.name, "/$"))'
      );
    });

    it("should write lists, comparisons and ranges", () => {
      expect(
        compileStorageClause("postgresql", {kind: "in", field: "content.type", values: ["a", "b"]})
      ).toBe('document.content.type in ["a", "b"]');
      expect(
        compileStorageClause("postgresql", {kind: "equals", field: "content.type", value: "x"})
      ).toBe('document.content.type == "x"');
      expect(
        compileStorageClause("postgresql", {kind: "notEqual", field: "content.type", value: "x"})
      ).toBe('document.content.type != "x"');
      expect(
        compileStorageClause("postgresql", {kind: "range", field: "content.size", gte: 1, lte: 5})
      ).toBe("(document.content.size >= 1 && document.content.size <= 5)");
      expect(
        compileStorageClause("postgresql", {kind: "range", field: "created_at", gte: "2026-01-01"})
      ).toBe('document.created_at >= "2026-01-01"');
    });

    it("should join clauses with &&", () => {
      expect(compileStorageClause("postgresql", allOf([matchesName("a"), nameEndsWithSlash()]))).toBe(
        '(regex(document.name, "a") && !(regex(document.name, "/$")))'
      );
    });

    it("should quote backslashes and quotes in a pattern", () => {
      expect(compileStorageClause("postgresql", matchesName(`^${escapeRegex('a"b.c')}`))).toBe(
        'regex(document.name, "^a\\"b\\\\.c")'
      );
    });
  });
});
