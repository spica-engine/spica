import {encrypt} from "../src/encrypt";
import {decrypt} from "../src/decrypt";

describe("decrypt", () => {
  const ENCRYPTION_SECRET = "test-encryption-secret";
  const HASH_SECRET = "test-hash-secret";

  it("should round-trip with queryable encrypt", () => {
    const original = "sensitive-data";
    const encrypted = encrypt(original, ENCRYPTION_SECRET, HASH_SECRET);
    const decrypted = decrypt(encrypted, ENCRYPTION_SECRET);

    expect(decrypted).toBe(original);
  });

  it("should round-trip with non-queryable encrypt", () => {
    const original = "sensitive-data";
    const encrypted = encrypt(original, ENCRYPTION_SECRET);
    const decrypted = decrypt(encrypted, ENCRYPTION_SECRET);

    expect(decrypted).toBe(original);
  });

  it("should decrypt unicode content", () => {
    const original = "données sensibles 日本語 🔐";
    const encrypted = encrypt(original, ENCRYPTION_SECRET);
    const decrypted = decrypt(encrypted, ENCRYPTION_SECRET);

    expect(decrypted).toBe(original);
  });

  it("should decrypt JSON content", () => {
    const original = JSON.stringify({userId: "123", purpose: "verify"});
    const encrypted = encrypt(original, ENCRYPTION_SECRET);
    const decrypted = decrypt(encrypted, ENCRYPTION_SECRET);

    expect(JSON.parse(decrypted)).toEqual({userId: "123", purpose: "verify"});
  });

  it("should throw with wrong secret", () => {
    const encrypted = encrypt("test", ENCRYPTION_SECRET);

    expect(() => decrypt(encrypted, "wrong-secret")).toThrow();
  });

  it("should throw when encrypted data is null", () => {
    expect(() => decrypt(null as any, ENCRYPTION_SECRET)).toThrow("Encrypted data is required.");
  });

  it("should throw when secret is empty", () => {
    const encrypted = encrypt("test", ENCRYPTION_SECRET);

    expect(() => decrypt(encrypted, "")).toThrow("Decryption secret is required.");
  });

  it("should throw when encrypted data has missing fields", () => {
    expect(() => decrypt({encrypted: "abc", iv: "", authTag: "def"}, ENCRYPTION_SECRET)).toThrow(
      "Invalid encrypted data format."
    );
  });
});
