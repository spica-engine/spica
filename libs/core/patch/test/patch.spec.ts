import {applyPatch, getUpdateQueryForPatch} from "@spica/core/patch";

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
    const query = getUpdateQueryForPatch(
      {title: "new_title", description: null},
      {title: "new_title"}
    );

    expect(query).toEqual({
      $set: {title: "new_title"},
      $unset: {description: ""}
    });
  });

  it("should get update query for nested objects", () => {
    const query = getUpdateQueryForPatch(
      {
        nested_object: {
          field2: null,
          field3: "put_me"
        }
      },
      {
        nested_object: {
          field3: "put_me"
        }
      }
    );

    expect(query).toEqual({
      $unset: {"nested_object.field2": ""},
      $set: {"nested_object.field3": "put_me"}
    });
  });

  it("should get update query for arrays", () => {
    const query = getUpdateQueryForPatch(
      {
        strings: ["new_value"]
      },
      {strings: ["new_value"]}
    );

    expect(query).toEqual({
      $set: {strings: ["new_value"]}
    });
  });

  it("should get update query for date", () => {
    const query = getUpdateQueryForPatch(
      {
        date: "2021-07-30T14:27:04.000Z"
      },
      {date: new Date("2021-07-30T14:27:04.000Z")}
    );

    expect(query).toEqual({
      $set: {date: new Date("2021-07-30T14:27:04.000Z")}
    });
  });
});
