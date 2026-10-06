import {describe, expect, it} from "@jest/globals";
import * as expression from "@spica-server/bucket-expression";

/**
 * `in` has always been in the grammar and the PostgreSQL compiler has implemented it from the start, while the
 * Mongo target and the predicate target did not — so the same expression worked on one backend and raised
 * `unknown binary operator in` on the other. These assert the three targets now agree.
 */
describe("the in operator", () => {
  describe("match target (Mongo)", () => {
    it("compiles a literal list", () => {
      expect(expression.aggregate(`document.role in ["admin", "editor"]`, {}, "match")).toEqual({
        $expr: {$in: ["$role", ["admin", "editor"]]}
      });
    });

    it("compiles a document field on the right", () => {
      expect(expression.aggregate(`"admin" in document.roles`, {}, "match")).toEqual({
        $expr: {$in: ["admin", "$roles"]}
      });
    });

    it("keeps the needle first, like $in", () => {
      const compiled: any = expression.aggregate(`document.a in document.b`, {}, "match");
      expect(compiled.$expr.$in).toEqual(["$a", "$b"]);
    });
  });

  describe("predicate target (rules and ACL)", () => {
    const run = (exp: string, context: unknown) => expression.run(exp, context, "default");

    it("is true when the list contains the value", () => {
      expect(run(`document.role in ["admin", "editor"]`, {document: {role: "editor"}})).toBe(true);
    });

    it("is false when it does not", () => {
      expect(run(`document.role in ["admin", "editor"]`, {document: {role: "viewer"}})).toBe(false);
    });

    it("reads a list from the document", () => {
      expect(run(`"admin" in document.roles`, {document: {roles: ["admin"]}})).toBe(true);
    });

    /**
     * The PostgreSQL compiler refuses this shape outright; answering "no match" here would make the same
     * expression behave differently per target, which is a silent difference between the backends.
     */
    it("raises when the right side is not a list", () => {
      expect(() => run(`"a" in document.role`, {document: {role: "a"}})).toThrow(/right side/);
    });
  });
});
