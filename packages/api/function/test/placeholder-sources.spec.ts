import {EnvVarSource, SecretSource} from "@spica-server/function/src/placeholder";

describe("placeholder sources", () => {
  describe("EnvVarSource", () => {
    it("should map env vars by key", () => {
      const fn: any = {env_vars: [{key: "A", value: "1"}]};

      expect(new EnvVarSource().load(fn)).toEqual(new Map([["A", "1"]]));
    });

    it("should tolerate a missing relation", () => {
      expect(new EnvVarSource().load({} as any).size).toEqual(0);
    });
  });

  describe("SecretSource", () => {
    const decrypt = ((secret: any) => ({...secret, value: `decrypted-${secret.value}`})) as any;

    it("should decrypt values", () => {
      const fn: any = {secrets: [{key: "S", value: "enc"}]};

      expect(new SecretSource(decrypt).load(fn)).toEqual(new Map([["S", "decrypted-enc"]]));
    });

    it("should tolerate a missing relation", () => {
      expect(new SecretSource(decrypt).load({} as any).size).toEqual(0);
    });
  });
});
