/**
 * Field-level ACL
 * ------------------------------------------------------------
 * Single source of truth for translating between the security presets shown in
 * the field-config form and the raw `acl` expression string the API stores on a
 * bucket property. The expression is read-visibility only: when it evaluates
 * false for a request, the API strips that field from the response. Expressions
 * reference `auth.*` (the requesting identity) and `document.*` (the row).
 *
 * Pure module — no React, no side effects.
 */

export type FieldAclMode = "everyone" | "authenticated" | "owner" | "custom";

export interface FieldSecurity {
  mode: FieldAclMode;
  expression: string;
  ownerField?: string;
}

const AUTHENTICATED_EXPRESSION = "auth._id != undefined";

// Owner preset: `document.<field> == auth._id`. Capture the field name so an
// existing expression authored by the preset round-trips back to owner mode.
const OWNER_EXPRESSION_PATTERN = /^document\.([A-Za-z_$][\w$]*)\s*==\s*auth\._id$/;

export function buildAclExpression(security?: FieldSecurity): string | undefined {
  if (!security) return undefined;

  switch (security.mode) {
    case "everyone":
      return undefined;
    case "authenticated":
      return AUTHENTICATED_EXPRESSION;
    case "owner": {
      const ownerField = security.ownerField?.trim();
      // Without a chosen owner field there is no canonical expression to emit;
      // the caller keeps whatever custom expression the user had instead.
      if (!ownerField) return undefined;
      return `document.${ownerField} == auth._id`;
    }
    case "custom": {
      const expression = security.expression?.trim();
      return expression ? expression : undefined;
    }
    default:
      return undefined;
  }
}

export function inferSecurityFromAcl(acl: string | undefined): FieldSecurity {
  const expression = acl?.trim();
  if (!expression) return {mode: "everyone", expression: ""};

  if (expression === AUTHENTICATED_EXPRESSION) {
    return {mode: "authenticated", expression};
  }

  const ownerMatch = expression.match(OWNER_EXPRESSION_PATTERN);
  if (ownerMatch) {
    return {mode: "owner", expression, ownerField: ownerMatch[1]};
  }

  return {mode: "custom", expression};
}

export function referencesScope(acl: string | undefined, scope: "auth" | "document"): boolean {
  if (!acl) return false;
  return new RegExp(`\\b${scope}\\.`).test(acl);
}

export function aclStatus(acl: string | undefined): "public" | "conditional" | "restricted" {
  if (!acl || !acl.trim()) return "public";
  if (referencesScope(acl, "document")) return "conditional";
  return "restricted";
}
