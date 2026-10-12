import {describe, expect, it} from "@jest/globals";
import {ObjectId} from "bson";
import {Bucket} from "@spica-server/interface-bucket";
import {inspectDocument} from "@spica-server/database-postgres";

const TARGET_ID = "67b3000000000000000000b3";

function bucket(properties: Record<string, any>): Bucket {
  return {
    _id: "67a1f0000000000000000001" as any,
    title: "T",
    description: "",
    primary: "title",
    acl: {read: "true==true", write: "true==true"},
    properties
  } as Bucket;
}

describe("inspectDocument", () => {
  it("no finding for a conforming document", () => {
    const found = inspectDocument(
      bucket({title: {type: "string"}, views: {type: "number"}, at: {type: "date"}}),
      {_id: new ObjectId(), title: "a", views: 1, at: new Date()}
    );
    expect(found).toEqual([]);
  });

  it("an _id that is not an ObjectId is reported", () => {
    const found = inspectDocument(bucket({title: {type: "string"}}), {_id: "hand-written"});
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("nonObjectIdId");
    expect(found[0].consequence).toContain("skipped");
  });

  it("a field that is not in the schema is reported", () => {
    const found = inspectDocument(bucket({title: {type: "string"}}), {title: "a", eski_alan: 42});
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({kind: "unknownField", path: "eski_alan", found: "number"});
  });

  it("a type mismatch is reported (the field became number but the old value is text)", () => {
    const found = inspectDocument(bucket({views: {type: "number"}}), {views: "42"});
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({kind: "typeMismatch", expected: "number", found: "string"});
  });

  it("text in a date field is reported", () => {
    const found = inspectDocument(bucket({at: {type: "date"}}), {at: "2026-01-01"});
    expect(found[0]).toMatchObject({kind: "typeMismatch", expected: "Date"});
  });

  it("an invalid onetoone reference is reported", () => {
    const found = inspectDocument(
      bucket({author: {type: "relation", relationType: "onetoone", bucketId: TARGET_ID}}),
      {author: "not-an-id"}
    );
    expect(found[0]).toMatchObject({kind: "invalidReference", path: "author"});
    expect(found[0].consequence).toContain("FK");
  });

  it("a valid hex string reference is accepted", () => {
    const found = inspectDocument(
      bucket({author: {type: "relation", relationType: "onetoone", bucketId: TARGET_ID}}),
      {author: new ObjectId().toHexString()}
    );
    expect(found).toEqual([]);
  });

  it("it is reported when onetomany is not an array", () => {
    const found = inspectDocument(
      bucket({authors: {type: "relation", relationType: "onetomany", bucketId: TARGET_ID}}),
      {authors: new ObjectId()}
    );
    expect(found[0].kind).toBe("nonObjectRelationList");
  });

  it("an invalid element inside onetomany is reported with its index", () => {
    const found = inspectDocument(
      bucket({authors: {type: "relation", relationType: "onetomany", bucketId: TARGET_ID}}),
      {authors: [new ObjectId(), "bozuk"]}
    );
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe("authors[1]");
  });

  it("a plain value instead of a language map on a translatable field is reported", () => {
    const found = inspectDocument(bucket({title: {type: "string", options: {translate: true}}}), {
      title: "untranslated"
    });
    expect(found[0]).toMatchObject({kind: "typeMismatch", expected: "language map (object)"});
  });

  it("a type error inside a translatable field is reported with its language code", () => {
    const found = inspectDocument(bucket({views: {type: "number", options: {translate: true}}}), {
      views: {tr_TR: 1, en_US: "iki"}
    });
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe("views.en_US");
  });

  it("a non-text element inside multiselect is reported", () => {
    const found = inspectDocument(bucket({tags: {type: "multiselect"}}), {tags: ["a", 2]});
    expect(found[0]).toMatchObject({kind: "typeMismatch", expected: "string[]"});
  });

  it("null values produce no finding", () => {
    const found = inspectDocument(bucket({title: {type: "string"}, views: {type: "number"}}), {
      title: null,
      views: null
    });
    expect(found).toEqual([]);
  });

  it("several findings are reported together", () => {
    const found = inspectDocument(bucket({title: {type: "string"}, views: {type: "number"}}), {
      _id: "bozuk",
      title: 1,
      views: "x",
      fazladan: true
    });
    expect(found.map(f => f.kind).sort()).toEqual([
      "nonObjectIdId",
      "typeMismatch",
      "typeMismatch",
      "unknownField"
    ]);
  });
});
