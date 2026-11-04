import {BadRequestException} from "@nestjs/common";
import {Session} from "@spica-server/data-postgresql-orm";
import {projectDocument} from "../../src/query/bucket/project";
import {orderBy} from "../../src/query/bucket/sort";
import {ReadPlan} from "../../src/query/bucket/plan";
import {BucketReads} from "../../src/query/bucket/reads";
import {countPlanOf, countTotal} from "../../src/query/bucket/totals";
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

const plan = (conditions: string[], extra: object = {}) =>
  ({
    metadata: ruleMetadata,
    conditions,
    joins: [],
    values: ["v", 10, 5],
    conditionValues: 1,
    ...extra
  }) as unknown as ReadPlan;

describe("countTotal", () => {
  const countPlan = (conditions: string[]) => countPlanOf(plan(conditions));

  const reads = (estimate: number) => ({
    plannerEstimate: jest.fn(async () => estimate),
    countMatching: jest.fn(async () => 7)
  });

  it("should count exactly when anything narrows the result", async () => {
    const stub = reads(1_000_000);

    expect(await countTotal(stub, countPlan([`("t"."age" > $1)`]))).toBe(7);
    expect(stub.plannerEstimate).not.toHaveBeenCalled();
  });

  it("should trust the estimate of a large bucket that nothing narrows", async () => {
    const stub = reads(1_000_000);

    expect(await countTotal(stub, countPlan([]))).toBe(1_000_000);
    expect(stub.plannerEstimate).toHaveBeenCalledWith(ruleMetadata.main.name);
    expect(stub.countMatching).not.toHaveBeenCalled();
  });

  it("should count a large bucket that nothing narrows when the exact number is asked for", async () => {
    const stub = reads(1_000_000);

    expect(await countTotal(stub, countPlan([]), {exact: true})).toBe(7);
    expect(stub.plannerEstimate).not.toHaveBeenCalled();
  });

  it.each([[9_999], [0], [-1]])(
    "should count a small bucket instead of trusting an estimate of %d",
    async estimate => {
      const stub = reads(estimate);

      expect(await countTotal(stub, countPlan([]))).toBe(7);
      expect(stub.countMatching).toHaveBeenCalledTimes(1);
    }
  );
});

describe("BucketReads", () => {
  const session = (rows: object[] = []) => {
    const raw = jest.fn(async () => ({rows}));
    return {raw, reads: new BucketReads({raw} as unknown as Session)};
  };

  it("should limit the transaction to reading and cut off a runaway statement", async () => {
    const {raw, reads} = session();

    await reads.restrictToReading();

    expect(raw.mock.calls[0][0]).toContain("READ ONLY");
    expect(raw.mock.calls[1]).toEqual([expect.stringContaining("statement_timeout"), ["30000"]]);
  });

  it("should page with the sort and bind the limit and the skip after the condition values", async () => {
    const {raw, reads} = session([{id: 1}]);
    const read = plan([`("t"."age" > $1)`]);

    expect(await reads.page(read, `"t"."id" ASC`, {limit: 5, skip: 10})).toEqual([{id: 1}]);

    const [text, values] = raw.mock.calls[0] as unknown as [string, unknown[]];
    expectSql(
      text,
      `SELECT "t".* FROM "${ruleMetadata.main.name}" AS "t" WHERE ("t"."age" > $1) ORDER BY "t"."id" ASC LIMIT $4 OFFSET $5`
    );
    expect(values).toEqual(["v", 10, 5, 5, 10]);
    expect(read.values).toEqual(["v", 10, 5]);
  });

  it("should leave out LIMIT and OFFSET when they are not asked for", async () => {
    const {raw, reads} = session();

    await reads.page(plan([]), `"t"."id" ASC`, {limit: 0});

    expect((raw.mock.calls[0] as unknown as [string])[0]).not.toMatch(/LIMIT|OFFSET/);
  });

  it("should read the children of a page by their parents, typed like the key", async () => {
    const {raw, reads} = session();

    await reads.childRows("bucket_x__tags", "bigint", ["1", "2"]);

    expect(raw.mock.calls[0]).toEqual([
      expect.stringContaining(`WHERE "_parent" = ANY($1::bigint[])`),
      [["1", "2"]]
    ]);
  });

  it("should read rows by their keys, typed like the key", async () => {
    const {raw, reads} = session([{id: "a"}]);

    expect(await reads.rowsWithKeys("bucket_x", "id", "uuid", ["a"])).toEqual([{id: "a"}]);

    expect(raw.mock.calls[0]).toEqual([
      expect.stringContaining(`FROM "bucket_x" WHERE "id" = ANY($1::uuid[])`),
      [["a"]]
    ]);
  });

  it("should count with the condition values only", async () => {
    const {raw, reads} = session([{total: "7"}]);

    expect(await reads.countMatching(countPlanOf(plan([`("t"."age" > $1)`])))).toBe(7);

    expect((raw.mock.calls[0] as unknown as [string, unknown[]])[1]).toEqual(["v"]);
  });

  it("should ask the planner for a table by its quoted name, and report -1 when it does not know", async () => {
    const known = session([{estimate: "12000"}]);
    expect(await known.reads.plannerEstimate("bucket_x")).toBe(12000);
    expect(known.raw.mock.calls[0]).toEqual([expect.stringContaining("reltuples"), ['"bucket_x"']]);

    expect(await session([]).reads.plannerEstimate("bucket_x")).toBe(-1);
  });
});
