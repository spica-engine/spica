import {isRelation, isObject, findRelations} from "./utilities";

describe("Utilities", () => {
  it("should check whether schema is object or not", () => {
    let schema = {
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
    let schema = {
      type: "relation",
      bucketId: "id1"
    };
    expect(isRelation(schema, "id1")).toEqual(true);

    expect(isRelation(schema, "id2")).toEqual(false);

    schema.type = "object";
    expect(isRelation(schema, "id1")).toEqual(false);
  });

  it("should find relations", () => {
    let schema = {
      nested_relation: {
        type: "object",
        properties: {
          here: {type: "relation", bucketId: "id1"},
          not_here: {type: "relation", bucketId: "id2"}
        }
      },
      root_relation: {type: "relation", bucketId: "id1"},
      not_relation: {type: "string"}
    };
    let targets = findRelations(schema, "id1", "", []);

    expect(targets).toEqual(["nested_relation.here", "root_relation"]);
  });
});
