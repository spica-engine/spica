import {hash} from "../src/hash";
import {isEncryptedData} from "../src/types";

describe("hash", () => {
  const SECRET = "test-hash-secret";

  it("should produce deterministic output", () => {
    const result1 = hash("test-value", SECRET);
    const result2 = hash("test-value", SECRET);

    expect(result1).toBe(result2);
  });

  it("should produce different hashes for different values", () => {
    const result1 = hash("value-a", SECRET);
    const result2 = hash("value-b", SECRET);

    expect(result1).not.toBe(result2);
  });

  it("should produce different hashes for different secrets", () => {
    const result1 = hash("test-value", "secret-a");
    const result2 = hash("test-value", "secret-b");

    expect(result1).not.toBe(result2);
  });

  it("should return a hex string", () => {
    const result = hash("test-value", SECRET);

    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should throw when secret is empty", () => {
    expect(() => hash("test-value", "")).toThrow("Hash secret is required.");
  });
});

describe("isEncryptedData", () => {
  it("should return true for valid encrypted data", () => {
    expect(isEncryptedData({encrypted: "abc", iv: "def", authTag: "ghi"})).toBe(true);
  });

  it("should return true for encrypted data with hash", () => {
    expect(isEncryptedData({encrypted: "abc", iv: "def", authTag: "ghi", hash: "jkl"})).toBe(true);
  });

  it("should return false for null", () => {
    expect(isEncryptedData(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isEncryptedData(undefined)).toBe(false);
  });

  it("should return false for a string", () => {
    expect(isEncryptedData("not-encrypted")).toBe(false);
  });

  it("should return false for an object missing encrypted", () => {
    expect(isEncryptedData({iv: "def", authTag: "ghi"})).toBe(false);
  });

  it("should return false for an object missing iv", () => {
    expect(isEncryptedData({encrypted: "abc", authTag: "ghi"})).toBe(false);
  });

  it("should return false for an object missing authTag", () => {
    expect(isEncryptedData({encrypted: "abc", iv: "def"})).toBe(false);
  });

  it("should return false for an array", () => {
    expect(isEncryptedData([{encrypted: "abc", iv: "def", authTag: "ghi"}])).toBe(false);
  });
});
