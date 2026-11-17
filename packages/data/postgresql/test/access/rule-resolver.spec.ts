import {compileRuleIn, InvalidRuleError, RuleContext} from "@spica-server/data-postgresql";
import {expectSql} from "./sql";

const columns: Record<string, {sql: string; type: "text" | "integer"}> = {
  email: {sql: `"u"."email"`, type: "text"},
  age: {sql: `"u"."age"`, type: "integer"}
};

function contextOf(auth: unknown = {}): RuleContext {
  return {
    auth,
    fields: {
      locate(path) {
        const column = columns[path.join(".")];
        if (!column) {
          throw new InvalidRuleError(`"${path.join(".")}" is not a column.`);
        }
        return {kind: "column", ...column, property: {type: column.type} as any};
      }
    }
  };
}

describe("compileRuleIn", () => {
  it("should read fields through the resolver it is given", () => {
    const values: unknown[] = [];
    const {sql, joins} = compileRuleIn(
      `document.email == "a@b.c" && document.age >= 18`,
      contextOf(),
      values
    );

    expectSql(sql, `("u"."email" = $1::text AND "u"."age" >= $2::bigint)`);
    expect(values).toEqual(["a@b.c", 18]);
    expect(joins).toEqual([]);
  });

  it("should resolve a bare name as a field too", () => {
    expect(compileRuleIn(`age > 3`, contextOf(), []).sql).toContain(`"u"."age" > `);
  });

  it("should let the resolver refuse a field", () => {
    expect(() => compileRuleIn(`document.secret == "x"`, contextOf(), [])).toThrow(
      InvalidRuleError
    );
  });

  it("should read auth from the context", () => {
    expect(compileRuleIn(`document.email == auth.email`, contextOf({email: "me"}), []).sql).toBe(
      `"u"."email" = $1::text`
    );
  });
});
