import {describe, it, expect} from "@jest/globals";
import {isPlaceholder, parsePlaceholder, toPlaceholder, unattachedReferences} from "./placeholder";

describe("parsePlaceholder", () => {
  it("should parse env var and secret placeholders", () => {
    expect(parsePlaceholder("${ENV.WARM}")).toEqual({source: "ENV", key: "WARM"});
    expect(parsePlaceholder("${SECRET.API_KEY}")).toEqual({source: "SECRET", key: "API_KEY"});
  });

  it("should accept keys containing dots and hyphens", () => {
    expect(parsePlaceholder("${ENV.my-app.warm}")).toEqual({source: "ENV", key: "my-app.warm"});
  });

  it.each([
    "plain",
    "",
    "${OTHER.KEY}",
    "${ENV.}",
    "${ENV.A B}",
    "x${ENV.KEY}",
    "${ENV.KEY}x",
    "${ENV.KEY}${ENV.OTHER}",
    5,
    null,
    undefined
  ])("should reject %p", value => {
    expect(parsePlaceholder(value)).toBeNull();
  });
});

describe("toPlaceholder", () => {
  it("should format a reference so that it parses back", () => {
    const reference = {source: "SECRET" as const, key: "TOKEN"};

    expect(toPlaceholder(reference)).toBe("${SECRET.TOKEN}");
    expect(parsePlaceholder(toPlaceholder(reference))).toEqual(reference);
  });
});

describe("isPlaceholder", () => {
  it("should tell placeholders from numbers and other strings", () => {
    expect(isPlaceholder("${ENV.WARM}")).toBe(true);
    expect(isPlaceholder(3)).toBe(false);
    expect(isPlaceholder("3")).toBe(false);
  });
});

describe("unattachedReferences", () => {
  const attached = new Set(["${ENV.ATTACHED}"]);

  it("should return the placeholders that are not attached yet", () => {
    expect(unattachedReferences(["${ENV.NEW}", "${SECRET.TOKEN}"], attached)).toEqual([
      {source: "ENV", key: "NEW"},
      {source: "SECRET", key: "TOKEN"}
    ]);
  });

  it("should skip attached placeholders, numbers and empty selections", () => {
    expect(unattachedReferences(["${ENV.ATTACHED}", 3, "", "plain"], attached)).toEqual([]);
  });

  it("should list a placeholder once even when several fields use it", () => {
    expect(unattachedReferences(["${ENV.NEW}", "${ENV.NEW}"], attached)).toEqual([
      {source: "ENV", key: "NEW"}
    ]);
  });
});
