import {describe, expect, it} from "@jest/globals";
import {dateSaveReadyValue, definedDefault} from "./saveValues";

describe("dateSaveReadyValue", () => {
  it("leaves an unset date out instead of sending the epoch", () => {
    expect(dateSaveReadyValue(null)).toBeUndefined();
    expect(dateSaveReadyValue(undefined)).toBeUndefined();
    expect(dateSaveReadyValue("")).toBeUndefined();
  });

  it("converts a date string and keeps a Date", () => {
    expect(dateSaveReadyValue("2026-01-01T00:00:00.000Z")).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    const date = new Date("2026-02-02T00:00:00.000Z");
    expect(dateSaveReadyValue(date)).toEqual(date);
  });

  it("leaves out a value that is not a date", () => {
    expect(dateSaveReadyValue("nope")).toBeUndefined();
  });
});

describe("definedDefault", () => {
  it("drops an empty default so it is not saved on the property", () => {
    expect(definedDefault("")).toBeUndefined();
    expect(definedDefault(null)).toBeUndefined();
    expect(definedDefault(undefined)).toBeUndefined();
  });

  it("keeps a default that was set, including zero and false", () => {
    expect(definedDefault(5)).toBe(5);
    expect(definedDefault(0)).toBe(0);
    expect(definedDefault(false)).toBe(false);
    expect(definedDefault("x")).toBe("x");
  });
});
