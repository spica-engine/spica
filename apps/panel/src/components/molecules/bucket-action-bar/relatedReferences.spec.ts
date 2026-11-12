import {describe, expect, it} from "@jest/globals";
import {relatedReferences} from "./relatedReferences";
import {DEFAULT_KEY_FIELD} from "../../../utils/recordKey";

const keyFieldOf = (bucketId: string | undefined) => (bucketId === "pg" ? "id" : DEFAULT_KEY_FIELD);

describe("relatedReferences", () => {
  it("names a one-to-one reference by its bucket and key", () => {
    expect(
      relatedReferences({owner: {id: "a"}}, [{title: "owner", bucketId: "pg"}], keyFieldOf)
    ).toEqual(["pg/a"]);
  });

  it("names every reference of a one-to-many relation", () => {
    expect(
      relatedReferences(
        {tags: [{[DEFAULT_KEY_FIELD]: "x"}, {[DEFAULT_KEY_FIELD]: "y"}]},
        [{title: "tags", bucketId: "mongo"}],
        keyFieldOf
      )
    ).toEqual(["mongo/x", "mongo/y"]);
  });

  it("counts nothing for an empty relation", () => {
    const relations = [
      {title: "owner", bucketId: "pg"},
      {title: "tags", bucketId: "mongo"}
    ];

    expect(relatedReferences({owner: null, tags: []}, relations, keyFieldOf)).toEqual([]);
    expect(relatedReferences({}, relations, keyFieldOf)).toEqual([]);
  });

  it("accepts a bare key, a numeric key and a formatted value", () => {
    const relations = [{title: "owner", bucketId: "pg"}];

    expect(relatedReferences({owner: "k"}, relations, keyFieldOf)).toEqual(["pg/k"]);
    expect(relatedReferences({owner: 7}, relations, keyFieldOf)).toEqual(["pg/7"]);
    expect(relatedReferences({owner: {value: "v", label: "l"}}, relations, keyFieldOf)).toEqual(["pg/v"]);
  });
});
