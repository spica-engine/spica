import {JSONSchema7} from "json-schema";
import {clearSchemaPaths, getLastNonSchemaPaths, schemaDiff} from "@spica/core";

describe("schema path", () => {
  const schema: JSONSchema7 = {
    properties: {
      test: {
        type: "string"
      },
      properties: {
        type: "object",
        properties: {
          test: {
            type: "string",
            enum: ["test"]
          }
        }
      },
      test2: {
        type: "array",
        options: {translate: true},
        items: {
          type: "string"
        }
      } as any, // options property is used by bucket properties.
      test3: {
        type: "array",
        items: {
          type: "array",
          items: {
            type: "string"
          }
        }
      }
    }
  };

  it("should convert array items property to regex", () => {
    expect(clearSchemaPaths(["properties", "test2", "items", "type"], schema, true)).toEqual([
      "test2",
      /[0-9]*/
    ]);
    expect(
      clearSchemaPaths(["properties", "test3", "items", "items", "type"], schema, true)
    ).toEqual(["test3", /[0-9]*/, /[0-9]*/]);
  });

  it("should strip root properties key", () => {
    expect(clearSchemaPaths(["properties", "test"], schema)).toEqual(["test"]);
    expect(clearSchemaPaths(["properties", "test2"], schema)).toEqual(["test2"]);
    expect(clearSchemaPaths(["properties", "properties", "properties", "test"], schema)).toEqual([
      "properties",
      "test"
    ]);
  });

  it("should strip parent key of array", () => {
    expect(clearSchemaPaths(["properties", "test2", "items", "type"], schema)).toEqual([
      "test2",
      "items"
    ]);
  });

  it("should return non-path segments", () => {
    expect(getLastNonSchemaPaths(["properties", "test2", "items", "type"], schema)).toEqual([
      "type"
    ]);
    expect(getLastNonSchemaPaths(["properties", "test2", "items", "type"], schema)).toEqual([
      "type"
    ]);
    expect(
      getLastNonSchemaPaths(["properties", "properties", "properties", "test", "enum"], schema)
    ).toEqual(["enum"]);
  });
});

describe("schema", () => {
  it("differ should return no changes", () => {
    const prev: JSONSchema7 = {};
    const current: JSONSchema7 = {};
    const changes = schemaDiff(prev, current);
    expect(changes.length).toBe(0);
  });

  it("differ should return root property changes", () => {
    const prev: JSONSchema7 = {
      properties: {
        test: {
          type: "string"
        }
      }
    };
    const current: JSONSchema7 = {
      properties: {
        test: {
          type: "number"
        }
      }
    };
    const changes = schemaDiff(prev, current);
    expect(changes.length).toBe(1);
    expect(changes[0].path).toEqual(["test"]);
    expect(changes[0].lastPath).toEqual(["type"]);
  });

  it("differ should return sub property changes", () => {
    const prev: JSONSchema7 = {
      properties: {
        test: {
          type: "string"
        }
      }
    };
    const current: JSONSchema7 = {
      properties: {
        test: {
          type: "string",
          options: {
            translate: true
          }
        } as any
      }
    };
    const changes = schemaDiff(prev, current);
    expect(changes.length).toBe(1);
    expect(changes[0].path).toEqual(["test"]);
    expect(changes[0].lastPath).toEqual(["options", "translate"]);
  });

  it("differ should return sub property changes", () => {
    const prev: JSONSchema7 = {
      properties: {
        test: {
          type: "string"
        }
      }
    };
    const current: JSONSchema7 = {
      properties: {
        test: {
          type: "string",
          options: {
            translate: true
          }
        } as any
      }
    };
    const changes = schemaDiff(prev, current);
    expect(changes.length).toBe(1);
    expect(changes[0].path).toEqual(["test"]);
    expect(changes[0].lastPath).toEqual(["options", "translate"]);
  });

  it("differ should return root property changes", () => {
    const prev: JSONSchema7 = {
      type: "string"
    };
    const current: JSONSchema7 = {
      type: "number"
    };
    const changes = schemaDiff(prev, current);
    expect(changes.length).toBe(1);
    expect(changes[0].path).toEqual([]);
    expect(changes[0].lastPath).toEqual(["type"]);
  });

  it("differ should return changes of a deleted property ", () => {
    const prev: JSONSchema7 = {
      properties: {
        del: {
          type: "string"
        }
      }
    };
    const current: JSONSchema7 = {
      properties: {}
    };
    const changes = schemaDiff(prev, current);
    expect(changes.length).toBe(1);
    expect(changes[0].path).toEqual(["del"]);
    expect(changes[0].lastPath).toEqual([]);
  });

  it("differ should return changes of a non-standart property", () => {
    const prev: JSONSchema7 = {
      properties: {
        relation: {
          type: "relation",
          title: "relation",
          description: "Description of 'relation'",
          relationType: "manytomany",
          bucket: "5d445b3ab25948e5625a89e0"
        } as any
      }
    };
    const current: JSONSchema7 = {
      properties: {
        relation: {
          type: "relation",
          title: "relation",
          description: "Description of 'relation'",
          relationType: "manytomany",
          bucket: "5d445b3ab25948e5625a99e0"
        } as any
      }
    };
    const changes = schemaDiff(prev, current);
    expect(changes.length).toBe(1);
    expect(changes[0].path).toEqual(["relation"]);
    expect(changes[0].lastPath).toEqual(["bucket"]);
  });
});
