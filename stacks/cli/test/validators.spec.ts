import {projectName} from "@spica/cli/src/validator";

describe("cli validators", () => {
  describe("namespace", () => {
    it("should validate against test-1", () => {
      expect(projectName("test-1")).toBe("test-1");
    });

    it("should not validate against 1-test", () => {
      expect(() => projectName("1-test")).toThrow(`1-test is an invalid namespace`);
    });

    it("should not validate against '1 test'", () => {
      expect(() => projectName("1 test")).toThrow(`1 test is an invalid namespace`);
    });
  });
});
