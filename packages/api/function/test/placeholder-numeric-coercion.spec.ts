import {parseNumber} from "@spica-server/function/src/placeholder";

describe("parseNumber", () => {
  const intRule = {min: 0, integer: true};

  it.each([
    [3, 3],
    ["3", 3],
    [" 3 ", 3],
    ["0", 0]
  ])("should accept %p", (raw, expected) => {
    expect(parseNumber(raw, intRule)).toEqual(expected);
  });

  it.each(["abc", "", "  ", NaN, Infinity, null, undefined, "${ENV.X}", "1.5", -1])(
    "should reject %p for a non-negative integer",
    raw => {
      expect(parseNumber(raw, intRule)).toBeUndefined();
    }
  );

  it("should enforce the minimum", () => {
    expect(parseNumber("0", {min: 1, integer: true})).toBeUndefined();
  });

  it("should accept fractions when integer is not required", () => {
    expect(parseNumber("1.5", {min: 0, integer: false})).toEqual(1.5);
  });
});
