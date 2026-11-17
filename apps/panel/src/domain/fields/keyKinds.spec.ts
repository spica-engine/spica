import {describe, it, expect} from "@jest/globals";
import {inputKindOf, isHiddenKeyProperty} from "./keyKinds";

describe("inputKindOf", () => {
  it("should edit uuid and bigint values as text and integer values as numbers", () => {
    expect(inputKindOf("uuid")).toBe("string");
    expect(inputKindOf("bigint")).toBe("string");
    expect(inputKindOf("integer")).toBe("number");
  });

  it("should leave every other type alone", () => {
    expect(inputKindOf("string")).toBe("string");
    expect(inputKindOf("relation")).toBe("relation");
    expect(inputKindOf("hash")).toBe("hash");
  });
});

describe("isHiddenKeyProperty", () => {
  const generated = {options: {generated: true}};
  const supplied = {options: {}};

  it("should hide a generated key when creating", () => {
    expect(isHiddenKeyProperty("id", generated, "id", false)).toBe(true);
  });

  it("should ask for a supplied key when creating", () => {
    expect(isHiddenKeyProperty("sku", supplied, "sku", false)).toBe(false);
    expect(isHiddenKeyProperty("sku", undefined, "sku", false)).toBe(false);
  });

  it("should hide the key of an existing document, however it was made", () => {
    expect(isHiddenKeyProperty("sku", supplied, "sku", true)).toBe(true);
    expect(isHiddenKeyProperty("id", generated, "id", true)).toBe(true);
  });

  it("should never hide another property", () => {
    expect(isHiddenKeyProperty("name", generated, "id", true)).toBe(false);
    expect(isHiddenKeyProperty("name", generated, undefined, true)).toBe(false);
  });
});
