import {emptyBucket} from "./interfaces/bucket";

describe("Bucket", () => {
  describe("emptyBucket", () => {
    it("should return object", () => {
      const emptyMeta = emptyBucket();
      expect(emptyMeta).not.toBeNull();
      expect(emptyMeta).not.toBeUndefined();
      expect(typeof emptyMeta === "object").toBeTruthy();
    });
    it("should have different references", () => {
      const emptyMeta = emptyBucket();
      const emptyMeta2 = emptyBucket();
      expect(emptyMeta).not.toEqual(emptyMeta2);
    });
  });
});
