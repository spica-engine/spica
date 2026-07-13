import {describe, it, expect} from "@jest/globals";
import {
  aclStatus,
  buildAclExpression,
  inferSecurityFromAcl,
  referencesScope,
  type FieldSecurity
} from "./field-acl";

describe("field-acl", () => {
  describe("buildAclExpression", () => {
    it("emits no acl for everyone", () => {
      expect(buildAclExpression({mode: "everyone", expression: ""})).toBeUndefined();
    });

    it("emits the canonical authenticated expression", () => {
      expect(buildAclExpression({mode: "authenticated", expression: ""})).toBe(
        "auth._id != undefined"
      );
    });

    it("emits the owner template from ownerField", () => {
      expect(
        buildAclExpression({mode: "owner", expression: "", ownerField: "author"})
      ).toBe("document.author == auth._id");
    });

    it("falls back to undefined for owner without a field", () => {
      expect(buildAclExpression({mode: "owner", expression: ""})).toBeUndefined();
    });

    it("trims a custom expression and drops empty", () => {
      expect(buildAclExpression({mode: "custom", expression: "  auth.role == 'admin'  "})).toBe(
        "auth.role == 'admin'"
      );
      expect(buildAclExpression({mode: "custom", expression: "   "})).toBeUndefined();
    });

    it("returns undefined when security is absent", () => {
      expect(buildAclExpression(undefined)).toBeUndefined();
    });
  });

  describe("inferSecurityFromAcl", () => {
    it("maps empty/undefined to everyone", () => {
      expect(inferSecurityFromAcl(undefined)).toEqual({mode: "everyone", expression: ""});
      expect(inferSecurityFromAcl("")).toEqual({mode: "everyone", expression: ""});
    });

    it("recognizes the authenticated expression", () => {
      expect(inferSecurityFromAcl("auth._id != undefined")).toEqual({
        mode: "authenticated",
        expression: "auth._id != undefined"
      });
    });

    it("recognizes the owner template and captures the field", () => {
      expect(inferSecurityFromAcl("document.author == auth._id")).toEqual({
        mode: "owner",
        expression: "document.author == auth._id",
        ownerField: "author"
      });
    });

    it("treats anything else as custom", () => {
      expect(inferSecurityFromAcl("auth.role == 'admin'")).toEqual({
        mode: "custom",
        expression: "auth.role == 'admin'"
      });
    });
  });

  describe("round-trip", () => {
    const presets: FieldSecurity[] = [
      {mode: "everyone", expression: ""},
      {mode: "authenticated", expression: ""},
      {mode: "owner", expression: "", ownerField: "author"},
      {mode: "custom", expression: "auth.role == 'admin'"}
    ];

    it.each(presets)("preserves the mode for %o", preset => {
      const acl = buildAclExpression(preset);
      expect(inferSecurityFromAcl(acl).mode).toBe(preset.mode);
    });

    it("keeps a hand-written custom expression as custom", () => {
      const acl = "document.author == auth._id || auth.role == 'admin'";
      const inferred = inferSecurityFromAcl(acl);
      expect(inferred.mode).toBe("custom");
      expect(buildAclExpression(inferred)).toBe(acl);
    });
  });

  describe("referencesScope", () => {
    it("detects auth and document references", () => {
      expect(referencesScope("auth._id != undefined", "auth")).toBe(true);
      expect(referencesScope("auth._id != undefined", "document")).toBe(false);
      expect(referencesScope("document.author == auth._id", "document")).toBe(true);
      expect(referencesScope(undefined, "auth")).toBe(false);
    });
  });

  describe("aclStatus", () => {
    it("classifies visibility", () => {
      expect(aclStatus(undefined)).toBe("public");
      expect(aclStatus("")).toBe("public");
      expect(aclStatus("document.author == auth._id")).toBe("conditional");
      expect(aclStatus("auth._id != undefined")).toBe("restricted");
      expect(aclStatus("false")).toBe("restricted");
    });
  });
});
