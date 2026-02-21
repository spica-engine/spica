import {applyPasswordPolicy} from "@spica-server/passport/src/password-policy.schema.resolver";

describe("applyPasswordPolicy", () => {
  const baseSchema = {
    $id: "http://spica.internal/passport/identity-create",
    type: "object",
    required: ["identifier", "password"],
    properties: {
      identifier: {type: "string", minLength: 3},
      password: {type: "string", minLength: 3}
    },
    additionalProperties: false
  };

  it("should return schema unchanged when policy is undefined", () => {
    const result = applyPasswordPolicy(baseSchema, undefined);
    expect(result).toEqual(baseSchema);
  });

  it("should return schema unchanged when policy is empty object", () => {
    const result = applyPasswordPolicy(baseSchema, {});
    expect(result).toEqual(baseSchema);
  });

  it("should not mutate the original schema", () => {
    const original = JSON.parse(JSON.stringify(baseSchema));
    applyPasswordPolicy(baseSchema, {minLength: 10});
    expect(baseSchema).toEqual(original);
  });

  it("should apply minLength", () => {
    const result = applyPasswordPolicy(baseSchema, {minLength: 8});
    expect(result["properties"]["password"]["minLength"]).toEqual(8);
  });

  it("should not apply minLength when it is 0", () => {
    const result = applyPasswordPolicy(baseSchema, {minLength: 0});
    expect(result["properties"]["password"]["minLength"]).toEqual(3);
  });

  it("should apply minLowercase pattern", () => {
    const result = applyPasswordPolicy(baseSchema, {minLowercase: 2});
    expect(result["properties"]["password"]["pattern"]).toEqual("^(?=(?:.*[a-z]){2}).*$");
  });

  it("should apply minUppercase pattern", () => {
    const result = applyPasswordPolicy(baseSchema, {minUppercase: 1});
    expect(result["properties"]["password"]["pattern"]).toEqual("^(?=(?:.*[A-Z]){1}).*$");
  });

  it("should apply minNumber pattern", () => {
    const result = applyPasswordPolicy(baseSchema, {minNumber: 3});
    expect(result["properties"]["password"]["pattern"]).toEqual("^(?=(?:.*\\d){3}).*$");
  });

  it("should apply minSpecialCharacter pattern", () => {
    const result = applyPasswordPolicy(baseSchema, {minSpecialCharacter: 1});
    expect(result["properties"]["password"]["pattern"]).toEqual("^(?=(?:.*[^a-zA-Z\\d\\s]){1}).*$");
  });

  it("should combine all patterns", () => {
    const result = applyPasswordPolicy(baseSchema, {
      minLength: 10,
      minLowercase: 1,
      minUppercase: 1,
      minNumber: 1,
      minSpecialCharacter: 1
    });
    expect(result["properties"]["password"]["minLength"]).toEqual(10);
    expect(result["properties"]["password"]["pattern"]).toEqual(
      "^(?=(?:.*[a-z]){1})(?=(?:.*[A-Z]){1})(?=(?:.*\\d){1})(?=(?:.*[^a-zA-Z\\d\\s]){1}).*$"
    );
  });

  it("should skip policies with value 0", () => {
    const result = applyPasswordPolicy(baseSchema, {
      minLowercase: 0,
      minUppercase: 1,
      minNumber: 0,
      minSpecialCharacter: 0
    });
    expect(result["properties"]["password"]["pattern"]).toEqual("^(?=(?:.*[A-Z]){1}).*$");
  });

  it("should not add pattern when no character requirements are set", () => {
    const result = applyPasswordPolicy(baseSchema, {minLength: 5});
    expect(result["properties"]["password"]["pattern"]).toBeUndefined();
  });

  it("should handle schema without password property gracefully", () => {
    const noPasswordSchema = {
      $id: "test",
      type: "object",
      properties: {
        name: {type: "string"}
      }
    };
    const result = applyPasswordPolicy(noPasswordSchema, {minLength: 10});
    expect(result).toEqual(noPasswordSchema);
  });

  describe("pattern validation against actual strings", () => {
    function matchesPattern(pattern: string, value: string): boolean {
      return new RegExp(pattern).test(value);
    }

    it("should match password with required lowercase chars", () => {
      const result = applyPasswordPolicy(baseSchema, {minLowercase: 2});
      const pattern = result["properties"]["password"]["pattern"];
      expect(matchesPattern(pattern, "abCD12!")).toBe(true);
      expect(matchesPattern(pattern, "ABCD12!")).toBe(false);
      expect(matchesPattern(pattern, "aBCD12!")).toBe(false);
    });

    it("should match password with required uppercase chars", () => {
      const result = applyPasswordPolicy(baseSchema, {minUppercase: 2});
      const pattern = result["properties"]["password"]["pattern"];
      expect(matchesPattern(pattern, "abCD12!")).toBe(true);
      expect(matchesPattern(pattern, "abcd12!")).toBe(false);
      expect(matchesPattern(pattern, "abCd12!")).toBe(false);
    });

    it("should match password with required numbers", () => {
      const result = applyPasswordPolicy(baseSchema, {minNumber: 2});
      const pattern = result["properties"]["password"]["pattern"];
      expect(matchesPattern(pattern, "abCD12!")).toBe(true);
      expect(matchesPattern(pattern, "abCDef!")).toBe(false);
    });

    it("should match password with required special chars", () => {
      const result = applyPasswordPolicy(baseSchema, {minSpecialCharacter: 1});
      const pattern = result["properties"]["password"]["pattern"];
      expect(matchesPattern(pattern, "abCD12!")).toBe(true);
      expect(matchesPattern(pattern, "abCD123")).toBe(false);
    });

    it("should match password with combined requirements", () => {
      const result = applyPasswordPolicy(baseSchema, {
        minLowercase: 1,
        minUppercase: 1,
        minNumber: 1,
        minSpecialCharacter: 1
      });
      const pattern = result["properties"]["password"]["pattern"];
      expect(matchesPattern(pattern, "aB1!")).toBe(true);
      expect(matchesPattern(pattern, "AB1!")).toBe(false);
      expect(matchesPattern(pattern, "ab1!")).toBe(false);
      expect(matchesPattern(pattern, "aBc!")).toBe(false);
      expect(matchesPattern(pattern, "aB12")).toBe(false);
    });
  });
});
