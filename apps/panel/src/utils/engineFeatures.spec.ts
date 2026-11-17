import {describe, it, expect} from "@jest/globals";
import {isFeatureAvailable} from "./engineFeatures";

describe("isFeatureAvailable", () => {
  it("should hide the profiler on PostgreSQL only", () => {
    expect(isFeatureAvailable("profiler", "postgresql")).toBe(false);
    expect(isFeatureAvailable("profiler", "mongodb")).toBe(true);
  });

  it("should keep a feature while the engine is not known", () => {
    expect(isFeatureAvailable("profiler", undefined)).toBe(true);
  });
});
