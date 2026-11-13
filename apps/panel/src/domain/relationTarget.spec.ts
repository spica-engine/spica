import {describe, it, expect} from "@jest/globals";
import {relationLabelField, relationSearchFilter, relationTarget, relationValueId} from "./relationTarget";
import {filterFieldTypeOf} from "./filterFieldType";
import {DEFAULT_KEY_FIELD} from "../utils/recordKey";

const pgBucket = {
  primary: "id",
  properties: {
    id: {type: "uuid"},
    qty: {type: "integer"},
    name: {type: "string"},
    notes: {type: "textarea"}
  }
};

describe("relationLabelField", () => {
  it("should use the display field on MongoDB", () => {
    expect(relationLabelField("mongodb", {primary: "title"})).toBe("title");
    expect(relationLabelField("mongodb", {})).toBeUndefined();
  });

  it("should use the first text property that is not the key on PostgreSQL", () => {
    expect(relationLabelField("postgresql", pgBucket)).toBe("name");
    expect(relationLabelField("postgresql", {primary: "sku", properties: {sku: {type: "string"}, n: {type: "textarea"}}})).toBe("n");
  });

  it("should have no label when there is no text property but the key", () => {
    expect(relationLabelField("postgresql", {primary: "id", properties: {id: {type: "uuid"}, qty: {type: "integer"}}})).toBeUndefined();
  });
});

describe("relationTarget", () => {
  it("should name the key and the label the way the engine does", () => {
    expect(relationTarget("mongodb", {primary: "title"})).toEqual({keyField: DEFAULT_KEY_FIELD, labelField: "title"});
    expect(relationTarget("postgresql", pgBucket)).toEqual({keyField: "id", labelField: "name"});
  });

  it("should be undefined until the engine is known", () => {
    expect(relationTarget(undefined, pgBucket)).toBeUndefined();
  });
});

describe("relationValueId", () => {
  it("should read ids of any shape", () => {
    expect(relationValueId("a")).toBe("a");
    expect(relationValueId(7)).toBe("7");
    expect(relationValueId({value: "a", label: "A"})).toBe("a");
    expect(relationValueId({kind: "id", id: "a"})).toBe("a");
    expect(relationValueId({[DEFAULT_KEY_FIELD]: "a", title: "t"})).toBe("a");
  });

  it("should prefer the related bucket's key field in a resolved document", () => {
    expect(relationValueId({sku: "k1", value: "other"}, "sku")).toBe("k1");
    expect(relationValueId({id: 3, name: "n"}, "id")).toBe("3");
  });

  it("should be undefined when there is nothing to read", () => {
    expect(relationValueId(undefined)).toBeUndefined();
    expect(relationValueId("")).toBeUndefined();
    expect(relationValueId({})).toBeUndefined();
    expect(relationValueId(true)).toBeUndefined();
  });
});

describe("relationSearchFilter", () => {
  it("should write a MongoDB regex, as before", () => {
    expect(relationSearchFilter("mongodb", "title", "a.b")).toEqual({
      $or: [{title: {$regex: "a.b", $options: "i"}}]
    });
    expect(relationSearchFilter(undefined, undefined, "x")).toEqual({
      $or: [{[DEFAULT_KEY_FIELD]: {$regex: "x", $options: "i"}}]
    });
  });

  it("should write an escaped expression on PostgreSQL", () => {
    expect(relationSearchFilter("postgresql", "name", "a.b")).toBe('regex(document.name, "a\\\\.b", "i")');
  });

  it("should not filter without a label field on PostgreSQL, or without text", () => {
    expect(relationSearchFilter("postgresql", undefined, "x")).toBeUndefined();
    expect(relationSearchFilter("postgresql", "na me", "x")).toBeUndefined();
    expect(relationSearchFilter("postgresql", "name", "")).toBeUndefined();
    expect(relationSearchFilter("mongodb", "title", undefined)).toBeUndefined();
  });
});

describe("filterFieldTypeOf", () => {
  it.each([
    ["string", "string"],
    ["textarea", "string"],
    ["number", "number"],
    ["integer", "number"],
    ["bigint", "bigint"],
    ["uuid", "id"],
    ["date", "date"],
    ["boolean", "boolean"],
    ["relation", "relation"],
    ["unknown", "string"]
  ])("should map %s to %s", (type, expected) => {
    expect(filterFieldTypeOf({type})).toBe(expected);
  });

  it("should offer a multiselect with options as an enum", () => {
    expect(filterFieldTypeOf({type: "multiselect", items: {enum: ["a"]}})).toBe("enum");
    expect(filterFieldTypeOf({type: "multiselect"})).toBe("string");
  });
});
