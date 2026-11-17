import {describe, it, expect} from "@jest/globals";
import {creationDate, timestampFromId} from "./idTimestamp";

const OBJECT_ID = "507f1f77bcf86cd799439011";
const UUID_V7 = "017f22e2-79b0-7cc3-98c4-dc0c0c07398f";

describe("timestampFromId", () => {
  it("should read seconds from an ObjectId", () => {
    expect(timestampFromId(OBJECT_ID)).toBe(Date.UTC(2012, 9, 17, 21, 13, 27));
  });

  it("should read milliseconds from a UUID v7", () => {
    expect(timestampFromId(UUID_V7)).toBe(Date.UTC(2022, 1, 22, 19, 22, 22));
    expect(timestampFromId(UUID_V7.toUpperCase())).toBe(Date.UTC(2022, 1, 22, 19, 22, 22));
  });

  it("should not read a time from anything else", () => {
    expect(timestampFromId("a1b2c3d4-0000-4000-8000-000000000000")).toBeUndefined();
    expect(timestampFromId("ActivityFullAccess")).toBeUndefined();
    expect(timestampFromId("")).toBeUndefined();
    expect(timestampFromId(undefined)).toBeUndefined();
  });
});

describe("creationDate", () => {
  it("should prefer the record's created_at", () => {
    expect(creationDate({created_at: "2026-01-02T03:04:05.000Z"}, OBJECT_ID).toISOString()).toBe(
      "2026-01-02T03:04:05.000Z"
    );
  });

  it("should fall back to the id", () => {
    expect(creationDate({}, UUID_V7).getTime()).toBe(Date.UTC(2022, 1, 22, 19, 22, 22));
    expect(creationDate({created_at: "not a date"}, OBJECT_ID).getTime()).toBe(
      Date.UTC(2012, 9, 17, 21, 13, 27)
    );
  });

  it("should be an invalid date when nothing says when", () => {
    expect(Number.isNaN(creationDate({}, "x").getTime())).toBe(true);
  });
});
