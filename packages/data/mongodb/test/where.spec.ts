import {BadRequestException} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {FilterNode} from "@spica-server/interface-bucket-common";
import {filterOf, renderWhere} from "../src/bucket/where";

const condition = (path: string[], operator: string, value: unknown, id?: boolean) => ({
  path,
  operator,
  value,
  ...(id && {id})
});

describe("renderWhere", () => {
  it("should write an equality as the value and any other operator as a $ operator", () => {
    expect(renderWhere(condition(["title"], "eq", "a"))).toEqual({title: "a"});
    expect(renderWhere(condition(["age"], "gte", 5))).toEqual({age: {$gte: 5}});
    expect(renderWhere(condition(["tags"], "all", ["a"]))).toEqual({tags: {$all: ["a"]}});
  });

  it("should join a path with dots", () => {
    expect(renderWhere(condition(["address", "city"], "eq", "Rome"))).toEqual({
      "address.city": "Rome"
    });
  });

  it("should write groups as $and and $or", () => {
    const node: FilterNode = {
      or: [{and: [condition(["a"], "eq", 1), condition(["a"], "eq", 2)]}, condition(["b"], "ne", 3)]
    };

    expect(renderWhere(node)).toEqual({
      $or: [{$and: [{a: 1}, {a: 2}]}, {b: {$ne: 3}}]
    });
  });

  it("should turn keys into ObjectIds, one by one in a list", () => {
    const first = "5f1e8b9c2a4d3e0012345678";
    const second = "5f1e8b9c2a4d3e0012345679";

    expect(renderWhere(condition(["_id"], "eq", first, true))).toEqual({
      _id: new ObjectId(first)
    });
    expect(renderWhere(condition(["_id"], "in", [first, second], true))).toEqual({
      _id: {$in: [new ObjectId(first), new ObjectId(second)]}
    });
  });
});

describe("filterOf", () => {
  const where = condition(["a"], "eq", 1);

  it("should leave the filter alone when there are no conditions", () => {
    expect(filterOf({filter: {a: 1}})).toEqual({a: 1});
    expect(filterOf({})).toBeUndefined();
  });

  it("should use the conditions alone, or together with a JSON filter", () => {
    expect(filterOf({where})).toEqual({a: 1});
    expect(filterOf({where, filter: {b: 2}})).toEqual({$and: [{b: 2}, {a: 1}]});
  });

  it("should refuse to combine conditions with an expression", () => {
    expect(() => filterOf({where, filter: "document.b == 2"})).toThrow(BadRequestException);
  });
});
