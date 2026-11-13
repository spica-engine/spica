import {describe, expect, it} from "@jest/globals";
import {configurationForEngine} from "./engineConfiguration";

const configuration = {primaryField: {}, uniqueValues: {}, requiredField: {}, index: {}};

describe("configurationForEngine", () => {
  it("keeps the primary field toggle on MongoDB, where it names the label field", () => {
    expect(Object.keys(configurationForEngine(configuration, "mongodb"))).toEqual([
      "primaryField",
      "uniqueValues",
      "requiredField",
      "index"
    ]);
  });

  it("hides it on PostgreSQL, where primary is the key", () => {
    expect(Object.keys(configurationForEngine(configuration, "postgresql"))).toEqual([
      "uniqueValues",
      "requiredField",
      "index"
    ]);
  });

  it("keeps it until the engine is known", () => {
    expect(Object.keys(configurationForEngine(configuration, undefined))).toContain("primaryField");
  });
});
