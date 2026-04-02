import {objectId} from "@spica-devkit/database";
import {ObjectId} from "mongodb";

describe("objectId", () => {
  it("should create", () => {
    const id = objectId();
    expect(id instanceof ObjectId).toBe(true);
  });

  it("should accept timestamp", () => {
    const id = objectId(Date.now());
    expect(id.getTimestamp() instanceof Date).toBe(true);
  });

  it("should accept string objectid", () => {
    const realId = new ObjectId();
    const id = objectId(realId.toHexString());
    expect(realId.toHexString()).toBe(id.toHexString());
  });

  it("should accept pre-existing objectid", () => {
    const preId = new ObjectId();
    const id = objectId(preId);
    expect(preId.equals(id)).toBe(true);
  });
});
