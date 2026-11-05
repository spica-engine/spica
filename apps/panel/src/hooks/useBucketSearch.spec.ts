import {describe, it, expect} from "@jest/globals";
import {buildBucketQuery} from "./useBucketSearch";

describe("buildBucketQuery", () => {
  it("should search with a regex per column in the language of MongoDB", () => {
    expect(buildBucketQuery("a.b", ["title", "body"], "mongodb").filter).toEqual({
      $or: [
        {title: {$regex: "a\\.b", $options: "i"}},
        {body: {$regex: "a\\.b", $options: "i"}}
      ]
    });
  });

  it("should search with an expression on PostgreSQL", () => {
    expect(buildBucketQuery("a.b", ["title", "body"], "postgresql").filter).toBe(
      `regex(document.title, "a\\\\.b", "i") || regex(document.body, "a\\\\.b", "i")`
    );
  });

  it("should leave out columns that are not field names on PostgreSQL", () => {
    expect(buildBucketQuery("a", ["title", "my-field", "a b"], "postgresql").filter).toBe(
      `regex(document.title, "a", "i")`
    );
  });

  it("should send no filter when no column can be searched", () => {
    expect(buildBucketQuery("a", [], "postgresql").filter).toBeUndefined();
    expect(buildBucketQuery("a", ["my-field"], "postgresql").filter).toBeUndefined();
    expect(buildBucketQuery("a", [], "mongodb").filter).toBeUndefined();
  });
});
