import {isRelation, isObject, findRelations, isArray, findRemovedKeys} from "./utilities";

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

  it("should check whether schema is array or not", () => {
    let schema = {type: "array", items: {type: "string"}};
    expect(isArray(schema)).toBe(true);

    schema.type = "string";
    expect(isArray(schema)).toBe(false);
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

  it("should find removed keys", () => {
    let previousSchema = {
      title: "test_title",
      description: "test_desc",
      properties: {
        nested_object: {
          type: "object",
          options: {},
          properties: {
            nested_object_child: {
              type: "object",
              properties: {
                removed: {type: "string"},
                not_removed: {type: "string"}
              }
            }
          }
        },
        nested_array_object: {
          type: "array",
          options: {},
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                removed: {type: "string"},
                not_removed: {type: "string"}
              }
            }
          }
        },
        root_removed: {
          type: "string",
          options: {}
        },
        nested_root_removed: {
          type: "object",
          properties: {
            dont_check_me: {
              type: "string"
            }
          }
        }
      }
    };

    let updatedSchema = {
      title: "test_title",
      description: "test_desc",
      properties: {
        nested_object: {
          type: "object",
          options: {},
          properties: {
            nested_object_child: {
              type: "object",
              properties: {
                not_removed: {type: "string"}
              }
            }
          }
        },
        nested_array_object: {
          type: "array",
          options: {},
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                not_removed: {type: "string"}
              }
            }
          }
        }
      }
    };

    let removedKeys = findRemovedKeys(previousSchema.properties, updatedSchema.properties, [], "");
    expect(removedKeys).toEqual([
      "nested_object.nested_object_child.removed",
      "nested_array_object.$[].$[].removed",
      "root_removed",
      "nested_root_removed"
    ]);
  });
});
