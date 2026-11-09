import {
  applyVisibility,
  compileFieldRules,
  fieldRulesOf,
  relationAlias,
  UnsupportedRuleError,
  visibilitySelect
} from "@spica-server/data-postgresql";
import {otherId, relatedFor, ruleMetadata, uuid, withFieldRules} from "./rule-fixtures";

async function compile(rules: Record<string, string>, auth: unknown = {}) {
  const bucket = withFieldRules(rules);
  const related = await relatedFor(Object.values(rules));
  const values: unknown[] = [];
  const compiled = compileFieldRules(
    {bucket, metadata: ruleMetadata, auth, table: "t", related},
    values
  );
  return {...compiled, values};
}

const author = relationAlias(["author"]);
const authorJoin = [
  `LEFT JOIN "bucket_${otherId}" AS "${author}"`,
  `ON "${author}"."id" = "t"."author"`
].join(" ");

describe("fieldRulesOf", () => {
  it("should list the top level properties that have a rule, in order", () => {
    expect(
      fieldRulesOf(withFieldRules({title: "true==true", age: "document.count > 1", note: ""}))
    ).toEqual([
      ["title", "true==true"],
      ["age", "document.count > 1"]
    ]);
  });

  it("should list nothing for a bucket without rules or properties", () => {
    expect(fieldRulesOf(withFieldRules({}))).toEqual([]);
    expect(fieldRulesOf({} as any)).toEqual([]);
  });
});

describe("compileFieldRules", () => {
  it("should have nothing to do without rules", async () => {
    expect(await compile({})).toEqual({hidden: [], conditional: [], joins: [], values: []});
  });

  it("should not list a field whose rule always holds", async () => {
    expect(await compile({title: "auth.role == 'admin'"}, {role: "admin"})).toEqual({
      hidden: [],
      conditional: [],
      joins: [],
      values: []
    });
    expect(await compile({title: "true==true"})).toMatchObject({hidden: [], conditional: []});
  });

  it("should hide a field whose rule never holds", async () => {
    expect(await compile({title: "auth.role == 'admin'"}, {role: "user"})).toMatchObject({
      hidden: ["title"],
      conditional: []
    });
    expect(await compile({title: "false==true"})).toMatchObject({hidden: ["title"]});
  });

  it("should turn any other rule into a flag", async () => {
    expect(await compile({age: "document.owner == auth._id"}, {_id: uuid})).toEqual({
      hidden: [],
      conditional: [{property: "age", column: "_visible_0", sql: '"t"."owner" = $1::uuid'}],
      joins: [],
      values: [uuid]
    });
  });

  it("should number the flags and the values across rules, in property order", async () => {
    const compiled = await compile({title: "document.age > 24", count: "document.count > 1"});
    expect(compiled.conditional).toEqual([
      {property: "title", column: "_visible_0", sql: '"t"."age" > $1::bigint'},
      {property: "count", column: "_visible_1", sql: '"t"."count" > $2::bigint'}
    ]);
    expect(compiled.values).toEqual([24, 1]);
  });

  it("should not spend a flag or a value on a rule that holds for everybody", async () => {
    const compiled = await compile({title: "true==true", age: "document.count > 1"});
    expect(compiled.conditional).toEqual([
      {property: "age", column: "_visible_0", sql: '"t"."count" > $1::bigint'}
    ]);
    expect(compiled.values).toEqual([1]);
  });

  it("should join a related bucket once for all the rules that use it", async () => {
    const compiled = await compile({
      title: "document.author.name == 'ann'",
      age: "document.author.level > 1"
    });
    expect(compiled.joins).toEqual([authorJoin]);
    expect(compiled.conditional.map(field => field.column)).toEqual(["_visible_0", "_visible_1"]);
  });

  it("should not join for a rule that was folded away", async () => {
    expect((await compile({title: "document.author.name == 'ann' || true"})).joins).toEqual([]);
  });

  it("should compare an encrypted field through its hash column", async () => {
    const compiled = await compile({title: "document.secret == 'x'"});
    expect(compiled.conditional).toEqual([
      {property: "title", column: "_visible_0", sql: '"t"."secret__hash" = $1::text'}
    ]);
    expect(compiled.values).toEqual(["x"]);
  });

  it("should refuse a rule that cannot be applied on PostgreSQL", async () => {
    await expect(compile({title: "document.note == 'x'"})).rejects.toThrow(UnsupportedRuleError);
  });
});

describe("visibilitySelect", () => {
  it("should select one flag per conditional field, false when the rule is NULL", async () => {
    const compiled = await compile({title: "document.age > 24", count: "auth.role == 'x'"});
    expect(visibilitySelect(compiled)).toEqual([
      'COALESCE("t"."age" > $1::bigint, FALSE) AS "_visible_0"'
    ]);
  });
});

describe("applyVisibility", () => {
  const rules = {
    hidden: ["owner"],
    conditional: [
      {property: "title", column: "_visible_0", sql: ""},
      {property: "age", column: "_visible_1", sql: ""}
    ],
    joins: []
  };
  const document = {title: "t", age: 3, owner: "o", count: 1};

  it("should remove the hidden fields and the fields whose flag is not true", () => {
    expect(applyVisibility(document, {_visible_0: true, _visible_1: false}, rules)).toEqual({
      title: "t",
      count: 1
    });
    expect(applyVisibility(document, {_visible_0: false, _visible_1: true}, rules)).toEqual({
      age: 3,
      count: 1
    });
  });

  it("should hide a field when its flag is missing or NULL", () => {
    expect(applyVisibility(document, {}, rules)).toEqual({count: 1});
    expect(applyVisibility(document, {_visible_0: null, _visible_1: null}, rules)).toEqual({
      count: 1
    });
  });

  it("should leave the document it was given alone", () => {
    applyVisibility(document, {}, rules);
    expect(document).toEqual({title: "t", age: 3, owner: "o", count: 1});
  });

  it("should keep everything when there are no rules", () => {
    expect(applyVisibility(document, {}, {hidden: [], conditional: [], joins: []})).toEqual(
      document
    );
  });
});
