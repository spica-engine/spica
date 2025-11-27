import {compile} from "@spica-server/bucket/expression/src/compile";
import {convert} from "@spica-server/bucket/expression/src/convert";
import {parser} from "@spica-server/bucket/expression/src/parser";
import {Mode} from "@spica-server/interface/bucket/expression";

describe("ACL Rule Replacer", () => {
  describe("Rules for read operation (convert mode)", () => {
    fit("should allow auth.correct username ", () => {
      const expression = "auth.username == 'user123'";
      const ast = parser.parse(expression);

      const compiled = compile(ast, "match" as Mode);

      const contextUser = {auth: {username: "user123"}};
      const result = compiled(contextUser);

      expect(result).toBe(true);
    });

    it("should not allow wrong auth.username", () => {
      const expression = "auth.username == 'user123'";
      const ast = parser.parse(expression);
      const compiled = compile(ast, "match" as Mode);

      const contextUser = {auth: {username: "wrongUser"}};
      const result = compiled(contextUser);

      expect(result).toBe(false);
    });

    it("should not allow equality check for other modules", () => {
      const expression = "auth.username == 'user123'";
      const ast = parser.parse(expression);
      const compiled = compile(ast, "match" as Mode);

      const contextUser = {auth: {identifier: "user123"}};
      const result = compiled(contextUser);

      expect(result).toBe(false);
    });

    it("should not affect non-auth expressions", () => {
      const expression = "document.title == 'test'";
      const ast = parser.parse(expression);
      const compiled = compile(ast, "match" as Mode);

      const correctContext = {auth: {username: "user123"}, document: {title: "test"}};
      const correctContext2 = {auth: {identifier: "identity123"}, document: {title: "test"}};
      const wrongContext = {auth: {username: "user123"}, document: {title: "wrong"}};

      const correctResult = compiled(correctContext);
      const correctResult2 = compiled(correctContext2);
      const wrongResult = compiled(wrongContext);

      expect(correctResult).toBe(true);
      expect(correctResult2).toBe(true);
      expect(wrongResult).toBe(false);
    });
    it("should handle complex expressions with multiple conditions", () => {
      const expression = "(auth.username == 'user1') && (document.status == 'active')";
      const ast = parser.parse(expression);
      const compiled = compile(ast, "match" as Mode);

      const correctContext = {
        auth: {username: "user1"},
        document: {status: "active"}
      };
      const wrongContext = {
        auth: {username: "wrongUser"},
        document: {status: "active"}
      };
      const wrongContext2 = {
        auth: {username: "user1"},
        document: {status: "inactive"}
      };

      const result = compiled(correctContext);
      const wrongResult = compiled(wrongContext);
      const wrongResult2 = compiled(wrongContext2);

      expect(result).toBe(true);
      expect(wrongResult).toBe(false);
      expect(wrongResult2).toBe(false);
    });
  });

  describe("Rules for write operation (compile mode)", () => {
    it("should convert auth.username == value to proper MongoDB query", () => {
      const expression = "auth.username == 'user123'";
      const ast = parser.parse(expression);
      const converted = convert(ast, "match");

      const usernameResult = converted({auth: {username: "user123"}});
      const identifierResult = converted({auth: {identifier: "wrongUser"}});

      expect(usernameResult).toEqual({
        $expr: {
          $eq: ["user123", "user123"]
        }
      });

      expect(identifierResult).toEqual({
        $expr: {
          $eq: [true, true]
        }
      });
    });
  });
});
