import {SelfWriteTracker} from "@spica-server/function/src/asset-write-tracker";

describe("SelfWriteTracker", () => {
  let tracker: SelfWriteTracker;

  const key1 = {functionId: "fn-abc", filename: "index.ts", hash: "aaa111"};

  beforeEach(() => {
    tracker = new SelfWriteTracker();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("stamp + isSelfWrite", () => {
    it("should return true for a stamped key within TTL", () => {
      tracker.stamp(key1);
      expect(tracker.isSelfWrite(key1)).toBe(true);
    });

    it("should return false for a key that was never stamped", () => {
      expect(tracker.isSelfWrite(key1)).toBe(false);
    });

    it("should return false when filename differs", () => {
      tracker.stamp(key1);
      expect(tracker.isSelfWrite({...key1, filename: "package.json"})).toBe(false);
    });

    it("should return false when hash differs", () => {
      tracker.stamp(key1);
      expect(tracker.isSelfWrite({...key1, hash: "bbb222"})).toBe(false);
    });

    it("should return false when functionId differs", () => {
      tracker.stamp(key1);
      expect(tracker.isSelfWrite({...key1, functionId: "fn-xyz"})).toBe(false);
    });
  });

  describe("TTL expiry", () => {
    it("should return false after TTL has elapsed", () => {
      jest.useFakeTimers();
      tracker.stamp(key1);
      // advance past the 10s TTL
      jest.advanceTimersByTime(11_000);
      expect(tracker.isSelfWrite(key1)).toBe(false);
    });

    it("should return true when checked within TTL", () => {
      jest.useFakeTimers();
      tracker.stamp(key1);
      jest.advanceTimersByTime(5_000);
      expect(tracker.isSelfWrite(key1)).toBe(true);
    });

    it("should reset TTL when re-stamped before expiry", () => {
      jest.useFakeTimers();
      tracker.stamp(key1);
      jest.advanceTimersByTime(8_000);
      // re-stamp: TTL should reset to now + 10s
      tracker.stamp(key1);
      jest.advanceTimersByTime(5_000);
      // total 13s since first stamp, but only 5s since re-stamp → still valid
      expect(tracker.isSelfWrite(key1)).toBe(true);
    });
  });

  describe("key isolation", () => {
    it("should track multiple different keys independently", () => {
      const key2 = {functionId: "fn-abc", filename: "package.json", hash: "ccc333"};
      tracker.stamp(key1);
      expect(tracker.isSelfWrite(key1)).toBe(true);
      expect(tracker.isSelfWrite(key2)).toBe(false);
    });
  });
});
