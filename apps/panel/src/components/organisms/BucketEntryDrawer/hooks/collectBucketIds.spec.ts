import {describe, expect, it} from "@jest/globals";
import {collectBucketIds} from "./collectBucketIds";

const relation = (bucketId: string, relationType = "onetoone") =>
  ({type: "relation", title: "x", bucketId, relationType}) as any;

describe("collectBucketIds", () => {
  it("gives two top-level relations to the same bucket separate state keys", () => {
    const collected = collectBucketIds(
      {author: relation("authors"), editors: relation("authors", "onetomany")},
      null
    );

    expect(collected.map(c => c.stateKey)).toEqual(["author", "editors"]);
    expect(collected.map(c => c.bucketId)).toEqual(["authors", "authors"]);
  });

  it("keys a relation nested in an object by its bucket id", () => {
    const collected = collectBucketIds(
      {meta: {type: "object", title: "meta", properties: {reviewer: relation("authors")}} as any},
      null
    );

    expect(collected.map(c => c.stateKey)).toEqual(["authors"]);
  });

  it("ignores properties that are not relations", () => {
    expect(collectBucketIds({title: {type: "string", title: "title"} as any}, null)).toEqual([]);
  });
});
