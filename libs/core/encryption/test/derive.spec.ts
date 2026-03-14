import {deriveKey, deriveKeyBuffer} from "../src/derive";

describe("deriveKey", () => {
  it("should return a 64-character hex string", () => {
    const result = deriveKey("test-input");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should be deterministic — same input always produces same output", () => {
    const result1 = deriveKey("my-master-key:bucket-data-hash-secret");
    const result2 = deriveKey("my-master-key:bucket-data-hash-secret");
    const result3 = deriveKey("my-master-key:bucket-data-hash-secret");

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it("should produce different outputs for different inputs", () => {
    const masterKey = "my-master-key";
    const derived1 = deriveKey(`${masterKey}:bucket-data-hash-secret`);
    const derived2 = deriveKey(`${masterKey}:bucket-data-encryption-secret`);
    const derived3 = deriveKey(`${masterKey}:user-verification-hash-secret`);
    const derived4 = deriveKey(`${masterKey}:passport-secret`);

    const allDerived = [derived1, derived2, derived3, derived4];
    const uniqueDerived = new Set(allDerived);
    expect(uniqueDerived.size).toBe(allDerived.length);
  });

  it("should produce different outputs for different master keys", () => {
    const result1 = deriveKey("master-key-1:bucket-data-hash-secret");
    const result2 = deriveKey("master-key-2:bucket-data-hash-secret");

    expect(result1).not.toBe(result2);
  });

  it("should work with composite key format used for secret derivation", () => {
    const masterKey = "super-secret-master-key-12345";
    const keyNames = [
      "bucket-data-hash-secret",
      "bucket-data-encryption-secret",
      "secret-module-encryption-secret",
      "user-verification-hash-secret",
      "user-provider-encryption-secret",
      "user-provider-hash-secret",
      "passport-secret"
    ];

    const derived = keyNames.map(name => deriveKey(`${masterKey}:${name}`));
    const uniqueDerived = new Set(derived);

    expect(uniqueDerived.size).toBe(keyNames.length);
    derived.forEach(d => {
      expect(d).toHaveLength(64);
      expect(d).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});

describe("deriveKeyBuffer", () => {
  it("should return a 32-byte Buffer", () => {
    const result = deriveKeyBuffer("test-input");
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(32);
  });

  it("should be consistent with deriveKey hex output", () => {
    const input = "my-master-key:bucket-data-hash-secret";
    const hexResult = deriveKey(input);
    const bufferResult = deriveKeyBuffer(input);

    expect(bufferResult.toString("hex")).toBe(hexResult);
  });
});
