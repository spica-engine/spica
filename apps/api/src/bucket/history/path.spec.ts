import {Path} from "@spica/api/src/bucket/history/path";
import {JSONSchema7} from "json-schema";

describe("Path", () => {
  it("set should set property", () => {
    const data: any = {};
    Path.set(data, ["tag"], "spica");
    Path.set(data, ["published"], true);
    Path.set(data, ["views"], 1);
    expect(data.tag).toBe("spica");
    expect(data.published).toBe(true);
    expect(data.views).toBe(1);
    expect(data).toEqual({tag: "spica", published: true, views: 1});
  });

  it("set should coerce object if undefined", () => {
    const data: any = {};
    Path.set(data, ["author", "name"], "spica");
    expect(data.author.name).toBe("spica");
  });

  it("set should coerce array if undefined", () => {
    const data: any = {};
    Path.set(data, ["authors", 0], "spica");
    expect(data.authors.length).toBe(1);
    expect(data.authors[0]).toBe("spica");
    expect(data).toEqual({authors: ["spica"]});
  });

  it("set should coerce multi-dimensional array if undefined", () => {
    const data: any = {};
    Path.set(data, ["authors", 0, 0], "spica");
    expect(data.authors.length).toBe(1);
    expect(data.authors[0].length).toBe(1);
    expect(data).toEqual({authors: [["spica"]]});
  });

  it("set should set property of sub document", () => {
    const data: any = {
      object: {
        string: "string",
        number: 1,
        boolean: true
      }
    };
    Path.set(data, ["object", "string"], "spica");
    expect(data.object.string).toBe("spica");
    Path.set(data, ["object", "number"], 3);
    expect(data.object.number).toBe(3);
    Path.set(data, ["object", "boolean"], false);
    expect(data.object.boolean).toBe(false);
  });

  it("set should set array item", () => {
    const data = {tags: []};
    Path.set(data, ["tags", 0], "spica");
    expect(data.tags.length).toBe(1);
    expect(data.tags[0]).toBe("spica");
  });

  const data = {
    author: {
      name: "spica",
      articles: 111,
      approved: true
    },
    views: [1, 2, 3, 5],
    comments: [
      {
        name: "John",
        comment: "Spica is awesome"
      },
      {
        name: "Peter",
        comment: "I do not like spica that much"
      }
    ]
  };

  it("get should return object", () => {
    expect(Path.get(["author"], data)).toEqual({name: "spica", articles: 111, approved: true});
  });

  it("get should resolve object property", () => {
    expect(Path.get(["author", "name"], data)).toBe("spica");
    expect(Path.get(["author", "articles"], data)).toBe(111);
    expect(Path.get(["author", "approved"], data)).toBe(true);
  });

  it("get should return array", () => {
    expect(Path.get(["comments"], data).length).toBe(2);
  });

  it("get should return array item", () => {
    expect(Path.get(["comments", 0], data)).toEqual({
      name: "John",
      comment: "Spica is awesome"
    });
  });

  it("get should return object property that inside array item", () => {
    expect(Path.get(["comments", 0, "name"], data)).toBe("John");
  });

  it("unset should delete object", () => {
    const data: any = {subdata: {test: true}};
    Path.unset(data, ["subdata"]);
    expect(data).toEqual({});
  });

  it("unset should delete object property", () => {
    const data: any = {subdata: {test: true}};
    Path.unset(data, ["subdata", "test"]);
    expect(data).toEqual({subdata: {}});
  });

  it("unset should delete array item", () => {
    const data: any = {subdata: {test: ["item"]}};
    Path.unset(data, ["subdata", "test", 0]);
    expect(data).toEqual({subdata: {test: []}});
  });

  it("unset should delete object property that inside array item", () => {
    const data: any = {subdata: {test: [{item: "test"}]}};
    Path.unset(data, ["subdata", "test", 0, "item"]);
    expect(data).toEqual({subdata: {test: [{}]}});
  });

  it("type should return object property type", () => {
    const schema: JSONSchema7 = {
      properties: {
        test: {type: "string"},
        storage: {type: "string"},
        test2: {
          type: "object",
          properties: {
            subprop: {
              type: "string"
            }
          }
        }
      }
    };
    expect(Path.type(["test"], schema)).toBe("string");
    expect(Path.type(["storage"], schema)).toBe("string");
    expect(Path.type(["test2", "subprop"], schema)).toBe("string");
  });

  it("type should return array item type", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        array: {
          type: "array",
          items: {
            type: "object",
            properties: {
              first: {
                type: "string"
              }
            }
          }
        }
      }
    };
    expect(Path.type(["array"], schema)).toBe("array");
    expect(Path.type(["array", 0], schema)).toBe("object");
    expect(Path.type(["array", 0, "first"], schema)).toBe("string");
  });
});
