import {ObjectId} from "@spica-server/database-testing";
import {filterReviver} from "@spica-server/bucket-common";

describe("filterReviver", () => {
  const hex = "5f1e8b9c2a4d3e0012345678";
  const revive = (filter: string) => JSON.parse(filter, filterReviver);

  it("should construct ids written as ObjectId(...)", () => {
    const {_id} = revive(`{"_id": "ObjectId(${hex})"}`);
    expect(_id).toBeInstanceOf(ObjectId);
    expect(_id.toHexString()).toEqual(hex);
  });

  it("should construct ids inside operators", () => {
    const {_id} = revive(`{"_id": {"$in": ["ObjectId(${hex})"]}}`);
    expect(_id.$in[0]).toEqual(new ObjectId(hex));
  });

  it("should reject an invalid id with the same message ObjectId gives", () => {
    let expected: Error;
    try {
      new ObjectId("nope");
    } catch (error) {
      expected = error;
    }
    expect(() => revive(`{"_id": "ObjectId(nope)"}`)).toThrow(expected.message);
  });

  it("should leave other strings untouched", () => {
    expect(revive(`{"title": "ObjectId"}`)).toEqual({title: "ObjectId"});
  });
});
