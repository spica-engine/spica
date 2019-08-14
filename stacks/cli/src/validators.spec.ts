import {namespace} from "./validators";

describe("cli validators", () => {
  describe("namespace", () => {
    it("should validate against test-1", () => {
      expect(namespace("test-1")).toBe(true);
    });

    it("should not validate against 1-test", () => {
      expect(namespace("1-test")).toContain(`1-test is an invalid namespace`);
    });

    it("should not validate against '1 test'", () => {
      expect(namespace("1 test")).toContain(`1 test is an invalid namespace`);
    });
  });
});
