import {BadRequestException} from "@nestjs/common";
import {Session} from "@spica-server/data-postgresql-orm";
import {projectDocument} from "../../src/query/bucket/project";
import {ReadPlan} from "../../src/query/bucket/plan";
import {orderBy} from "../../src/query/bucket/sort";
import {countTotal} from "../../src/query/bucket/totals";
import {ruleMetadata} from "../access/rule-fixtures";
import {expectSql} from "../access/sql";

describe("orderBy", () => {
  it("should end with the key so paging is stable", () => {
    expectSql(orderBy(ruleMetadata), `"t"."id" ASC`);
    expectSql(
      orderBy(ruleMetadata, {age: -1, title: 1}),
      `"t"."age" DESC NULLS LAST, "t"."title" ASC NULLS FIRST, "t"."id" ASC`
    );
  });

  it("should not repeat the key", () => {
    expectSql(orderBy(ruleMetadata, {id: -1}), `"t"."id" DESC NULLS LAST`);
  });

  it("should read nested paths and sort strings of directions", () => {
    expectSql(
      orderBy(ruleMetadata, {"address.city": "-1"}),
      `"t"."address__city" DESC NULLS LAST, "t"."id" ASC`
    );
  });

  it.each([["nope"], ["tags"], ["label"], ["editors"]])("should refuse to sort by %s", field => {
    expect(() => orderBy(ruleMetadata, {[field]: 1})).toThrow(BadRequestException);
  });
});

describe("projectDocument", () => {
  const document = {id: "k", title: "a", age: 3, address: {city: "Rome", street: "x"}};

  it("should return the document when nothing is requested", () => {
    expect(projectDocument(document, [], "id")).toBe(document);
  });

  it("should keep the key and the requested paths", () => {
    expect(projectDocument(document, [["title"], ["address", "city"]], "id")).toEqual({
      id: "k",
      title: "a",
      address: {city: "Rome"}
    });
  });

  it("should leave out paths the document does not have", () => {
    expect(projectDocument(document, [["nope"], ["address", "nope", "deeper"]], "id")).toEqual({
      id: "k"
    });
  });
});

describe("countTotal", () => {
  const plan = (conditions: string[]) =>
    ({
      metadata: ruleMetadata,
      conditions,
      joins: [],
      values: ["v", 10, 5],
      conditionValues: 1
    }) as unknown as ReadPlan;

  const session = (estimate: number) => {
    const raw = jest.fn(async (sql: string) => ({
      rows: [sql.includes("reltuples") ? {estimate} : {total: "7"}]
    }));
    return {raw, session: {raw} as unknown as Session};
  };

  it("should count exactly when anything narrows the result", async () => {
    const {raw, session: stub} = session(1_000_000);

    expect(await countTotal(stub, plan([`("t"."age" > $1)`]))).toBe(7);
    expect(raw).toHaveBeenCalledTimes(1);
    expect(raw.mock.calls[0][1]).toEqual(["v"]);
    expect(raw.mock.calls[0][0]).toContain(`WHERE ("t"."age" > $1)`);
  });

  it("should trust the estimate of a large bucket that nothing narrows", async () => {
    const {raw, session: stub} = session(1_000_000);

    expect(await countTotal(stub, plan([]))).toBe(1_000_000);
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it.each([[9_999], [0], [-1]])(
    "should count a small bucket instead of trusting an estimate of %d",
    async estimate => {
      const {raw, session: stub} = session(estimate);

      expect(await countTotal(stub, plan([]))).toBe(7);
      expect(raw).toHaveBeenCalledTimes(2);
      expect(raw.mock.calls[1][0]).not.toContain("WHERE");
    }
  );
});
