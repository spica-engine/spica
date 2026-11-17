import {HttpStatus} from "@nestjs/common";
import {assertFilterLanguage, FilterLanguageError, filterLanguageOf} from "@spica-server/data";

describe("filter language", () => {
  describe("filterLanguageOf", () => {
    it("should call an object json and a string an expression", () => {
      expect(filterLanguageOf({age: {$gt: 5}})).toBe("json");
      expect(filterLanguageOf("document.age > 5")).toBe("expression");
    });

    it("should leave an empty filter without a language", () => {
      for (const empty of [undefined, null, {}, "", "  "]) {
        expect(filterLanguageOf(empty)).toBeUndefined();
      }
    });
  });

  describe("assertFilterLanguage", () => {
    it("should accept a filter in an accepted language", () => {
      expect(() => assertFilterLanguage({a: 1}, ["json"], "MongoDB")).not.toThrow();
      expect(() => assertFilterLanguage("a == 1", ["expression"], "PostgreSQL")).not.toThrow();
      expect(() => assertFilterLanguage({a: 1}, ["json", "expression"], "MongoDB")).not.toThrow();
    });

    it("should accept an empty filter whatever the engine accepts", () => {
      expect(() => assertFilterLanguage({}, ["expression"], "PostgreSQL")).not.toThrow();
      expect(() => assertFilterLanguage(undefined, ["json"], "MongoDB")).not.toThrow();
    });

    it("should answer 404 for a filter in the other language", () => {
      const error = (() => {
        try {
          assertFilterLanguage({a: 1}, ["expression"], "PostgreSQL");
        } catch (error) {
          return error;
        }
      })();

      expect(error).toBeInstanceOf(FilterLanguageError);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.message).toContain("json filter is not supported on PostgreSQL");
      expect(() => assertFilterLanguage("a == 1", ["json"], "MongoDB")).toThrow(
        FilterLanguageError
      );
    });
  });
});
