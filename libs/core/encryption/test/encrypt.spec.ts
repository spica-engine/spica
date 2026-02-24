import {encrypt} from "../src/encrypt";

describe("encrypt", () => {
  const ENCRYPTION_SECRET = "test-encryption-secret";
  const HASH_SECRET = "test-hash-secret";

  describe("queryable (with hashSecret)", () => {
    it("should return encrypted data with hash", () => {
      const result = encrypt("test-value", ENCRYPTION_SECRET, HASH_SECRET);

      expect(result).toHaveProperty("encrypted");
      expect(result).toHaveProperty("iv");
      expect(result).toHaveProperty("authTag");
      expect(result).toHaveProperty("hash");
      expect(typeof result.encrypted).toBe("string");
      expect(typeof result.iv).toBe("string");
      expect(typeof result.authTag).toBe("string");
      expect(typeof result.hash).toBe("string");
    });

    it("should produce deterministic hash for the same value", () => {
      const result1 = encrypt("test-value", ENCRYPTION_SECRET, HASH_SECRET);
      const result2 = encrypt("test-value", ENCRYPTION_SECRET, HASH_SECRET);

      expect(result1.hash).toBe(result2.hash);
    });

    it("should produce unique IVs for the same value", () => {
      const result1 = encrypt("test-value", ENCRYPTION_SECRET, HASH_SECRET);
      const result2 = encrypt("test-value", ENCRYPTION_SECRET, HASH_SECRET);

      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.encrypted).not.toBe(result2.encrypted);
    });

    it("should produce different hashes for different hash secrets", () => {
      const result1 = encrypt("test-value", ENCRYPTION_SECRET, "secret-a");
      const result2 = encrypt("test-value", ENCRYPTION_SECRET, "secret-b");

      expect(result1.hash).not.toBe(result2.hash);
    });

    it("should throw when value is empty", () => {
      expect(() => encrypt("", ENCRYPTION_SECRET, HASH_SECRET)).toThrow(
        "Value to encrypt is required."
      );
    });

    it("should throw when encryption secret is empty", () => {
      expect(() => encrypt("test-value", "", HASH_SECRET)).toThrow(
        "Encryption secret is required."
      );
    });
  });

  describe("non-queryable (without hashSecret)", () => {
    it("should return encrypted data without hash", () => {
      const result = encrypt("test-value", ENCRYPTION_SECRET);

      expect(result).toHaveProperty("encrypted");
      expect(result).toHaveProperty("iv");
      expect(result).toHaveProperty("authTag");
      expect(result).not.toHaveProperty("hash");
    });

    it("should produce unique IVs for the same value", () => {
      const result1 = encrypt("test-value", ENCRYPTION_SECRET);
      const result2 = encrypt("test-value", ENCRYPTION_SECRET);

      expect(result1.iv).not.toBe(result2.iv);
    });

    it("should throw when value is empty", () => {
      expect(() => encrypt("", ENCRYPTION_SECRET)).toThrow("Value to encrypt is required.");
    });

    it("should throw when encryption secret is empty", () => {
      expect(() => encrypt("test-value", "")).toThrow("Encryption secret is required.");
    });
  });
});
