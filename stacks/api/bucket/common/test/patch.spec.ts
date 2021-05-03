import {applyPatch, getUpdateQueryForPatch} from "@spica-server/bucket/common";

describe("Merge/Patch", () => {
  it("should get patched document", () => {
    const previousDocument = {
      title: "title",
      description: "description"
    };
    const patchQuery = {
      title: "new_title",
      description: null
    };
    const patchedDocument = applyPatch(previousDocument, patchQuery);
    expect(patchedDocument).toEqual({
      title: "new_title"
    });
  });

  it("should get update query", () => {
    const query = getUpdateQueryForPatch({title: "new_title", description: null});

    expect(query).toEqual({
      $set: {title: "new_title"},
      $unset: {description: ""}
    });
  });

  it("should get update query for nested objects", () => {
    const query = getUpdateQueryForPatch({
      nested_object: {
        field2: null
      }
    });

    expect(query).toEqual({
      $unset: {"nested_object.field2": ""}
    });
  });

  it("should get update query for arrays", () => {
    const query = getUpdateQueryForPatch({
      strings: ["new_value"]
    });

    expect(query).toEqual({
      $set: {strings: ["new_value"]}
    });
  });
});
