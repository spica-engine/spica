import {renderResourceFilter} from "@spica-server/database-pipeline";
import {ObjectId} from "@spica-server/database";

const parse = (id: string) => new ObjectId(id);
const a = "5f1e8b9c2a4d3e0000000001";
const b = "5f1e8b9c2a4d3e0000000002";
const c = "5f1e8b9c2a4d3e0000000003";

describe("renderResourceFilter", () => {
  it("should render nothing when there is no filter", () => {
    expect(renderResourceFilter(undefined, parse)).toBeUndefined();
  });

  it("should match everything when include and exclude are empty", () => {
    expect(renderResourceFilter({include: [], exclude: []}, parse)).toEqual({$match: {}});
  });

  it("should render include as $in", () => {
    expect(renderResourceFilter({include: [a, b], exclude: []}, parse)).toEqual({
      $match: {$or: [{_id: {$in: [new ObjectId(a), new ObjectId(b)]}}]}
    });
  });

  it("should render each exclude list as its own $nin alternative", () => {
    expect(renderResourceFilter({include: [], exclude: [[a], [b, c]]}, parse)).toEqual({
      $match: {
        $or: [{_id: {$nin: [new ObjectId(a)]}}, {_id: {$nin: [new ObjectId(b), new ObjectId(c)]}}]
      }
    });
  });

  it("should put include after the exclude alternatives", () => {
    expect(renderResourceFilter({include: [c], exclude: [[a]]}, parse)).toEqual({
      $match: {
        $or: [{_id: {$nin: [new ObjectId(a)]}}, {_id: {$in: [new ObjectId(c)]}}]
      }
    });
  });

  it("should drop duplicate ids", () => {
    expect(renderResourceFilter({include: [a, a], exclude: [[b, b]]}, parse)).toEqual({
      $match: {
        $or: [{_id: {$nin: [new ObjectId(b)]}}, {_id: {$in: [new ObjectId(a)]}}]
      }
    });
  });

  it("should keep an empty exclude list as an alternative that allows everything", () => {
    expect(renderResourceFilter({include: [], exclude: [[]]}, parse)).toEqual({
      $match: {$or: [{_id: {$nin: []}}]}
    });
  });

  it("should reject ids the parser rejects", () => {
    expect(() => renderResourceFilter({include: ["nope"], exclude: []}, parse)).toThrow();
  });
});
