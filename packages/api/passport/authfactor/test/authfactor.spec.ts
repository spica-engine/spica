import {AuthFactor} from "@spica-server/passport-authfactor";
import {Factor, FactorMeta} from "@spica-server/interface-passport-authfactor";

describe("AuthFactor", () => {
  let authFactor: AuthFactor;

  const totpMeta: FactorMeta = {type: "totp", config: {}, secret: "shh"};

  beforeEach(() => {
    const factorsMap = new Map<string, any>([
      [
        "totp",
        {
          instanceFactory: (meta: FactorMeta) =>
            ({
              meta,
              name: "totp",
              start: () => Promise.resolve("challenge"),
              authenticate: () => Promise.resolve(true),
              getMeta: () => meta,
              getSecretFields: () => ["secret"]
            }) as Factor,
          schemaProvider: () => Promise.resolve({type: "totp"} as any)
        }
      ]
    ]);

    authFactor = new AuthFactor(factorsMap, undefined);
  });

  describe("getFactor", () => {
    it("should resolve a registered factor", () => {
      expect(() => authFactor.getFactor(totpMeta)).not.toThrow();
    });

    it("should throw a clear error when meta is null instead of a TypeError", () => {
      expect(() => authFactor.getFactor(null)).toThrowError("Factor meta is missing.");
    });

    it("should throw a clear error when meta is undefined", () => {
      expect(() => authFactor.getFactor(undefined)).toThrowError("Factor meta is missing.");
    });

    it("should throw for an unknown factor type", () => {
      expect(() => authFactor.getFactor({type: "unknown", config: {}})).toThrowError(
        "Unknown factor named 'unknown'."
      );
    });
  });

  describe("register", () => {
    it("should not crash with a null meta, surfacing a clear error instead", () => {
      expect(() => authFactor.register("identity-id", null)).toThrowError(
        "Factor meta is missing."
      );
      expect(authFactor.hasFactor("identity-id")).toEqual(false);
    });

    it("should register a factor from a valid meta", () => {
      authFactor.register("identity-id", totpMeta);
      expect(authFactor.hasFactor("identity-id")).toEqual(true);
    });
  });
});
