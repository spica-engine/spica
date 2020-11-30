import {
  findRelations,
  getUpdateParams,
  isArray,
  isObject,
  isDesiredRelation
} from "@spica-server/bucket/src/relation";

describe("Relation", () => {
  it("should check whether schema is object or not", () => {
    const schema = {
      type: "object",
      properties: {
        test: ""
      }
    };
    expect(isObject(schema)).toBe(true);

    schema.type = "string";
    expect(isObject(schema)).toBe(false);
  });

  it("should check whether schema is correct relation or not", () => {
    const schema = {
      type: "relation",
      bucketId: "id1"
    };
    expect(isDesiredRelation(schema, "id1")).toEqual(true);

    expect(isDesiredRelation(schema, "id2")).toEqual(false);

    schema.type = "object";
    expect(isDesiredRelation(schema, "id1")).toEqual(false);
  });

  it("should check whether schema is array or not", () => {
    const schema = {type: "array", items: {type: "string"}};
    expect(isArray(schema)).toBe(true);

    schema.type = "string";
    expect(isArray(schema)).toBe(false);
  });

  it("should find relations", () => {
    const schema = {
      nested_relation: {
        type: "object",
        properties: {
          one_to_one: {type: "relation", bucketId: "id1", relationType: "onetoone"},
          one_to_many: {type: "relation", bucketId: "id1", relationType: "onetomany"},
          not_here: {type: "relation", bucketId: "id2"}
        }
      },
      root_relation: {type: "relation", bucketId: "id1", relationType: "onetoone"},
      not_relation: {type: "string"}
    };
    const targets = findRelations(schema, "id1", "", new Map());

    expect(targets).toEqual(
      new Map([
        ["nested_relation.one_to_one", "onetoone"],
        ["nested_relation.one_to_many", "onetomany"],
        ["root_relation", "onetoone"]
      ])
    );
  });

  it("should get update operation params for one to one relation", () => {
    const updateParams = getUpdateParams("test_key", "onetoone", "document_id");
    expect(updateParams).toEqual({
      filter: {test_key: "document_id"},
      update: {$unset: {test_key: ""}}
    });
  });

  it("should get update operation params for one to many relation", () => {
    const updateParams = getUpdateParams("test_key", "onetomany", "document_id");
    expect(updateParams).toEqual({
      filter: {test_key: {$in: ["document_id"]}},
      update: {$pull: {test_key: "document_id"}}
    });
  });
});
