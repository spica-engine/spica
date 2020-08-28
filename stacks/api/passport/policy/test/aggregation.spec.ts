import {policyAggregation} from "@spica-server/passport/policy";
import {ObjectId} from "@spica-server/database";

describe("policyAggregation", () => {
  let allowedId;
  let deniedId;

  beforeEach(() => {
    allowedId = new ObjectId();
    deniedId = new ObjectId();
  });

  it("should return empty aggregation if allowed all", () => {
    expect(policyAggregation({alloweds: ["*"], denieds: []})).toEqual([]);
  });

  it("should return aggregation if denied resource exists", () => {
    expect(policyAggregation({alloweds: [], denieds: [deniedId]})).toEqual([
      {
        $match: {
          _id: {
            $nin: [deniedId]
          }
        }
      }
    ]);
  });

  it("should return aggregation if allowed resource exists", () => {
    expect(policyAggregation({alloweds: [allowedId], denieds: []})).toEqual([
      {
        $match: {
          _id: {
            $in: [allowedId]
          }
        }
      }
    ]);
  });

  it("should return aggregation if allowed and denied resources exist", () => {
    expect(policyAggregation({alloweds: [allowedId], denieds: [deniedId]})).toEqual([
      {
        $match: {
          _id: {
            $in: [allowedId],
            $nin: [deniedId]
          }
        }
      }
    ]);
  });
});
