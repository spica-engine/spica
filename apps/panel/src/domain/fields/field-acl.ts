import {DEFAULT_KEY_FIELD} from "../../utils/recordKey";
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
  /** How the engine names the requester's key in `auth`: `_id` on MongoDB, `id` on PostgreSQL. */
  principalKey?: string;
}

const DEFAULT_PRINCIPAL_KEY = DEFAULT_KEY_FIELD;

// PostgreSQL's rule compiler has no `undefined` literal, so a key other than MongoDB's is
// checked with has().
const authenticatedExpression = (principalKey: string) =>
  principalKey === DEFAULT_PRINCIPAL_KEY ? `auth.${principalKey} != undefined` : `has(auth.${principalKey})`;

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Owner preset: `document.<field> == auth.<key>`. Capture the field name so an
// existing expression authored by the preset round-trips back to owner mode.
const ownerExpressionPattern = (principalKey: string) =>
  new RegExp(`^document\\.([A-Za-z_$][\\w$]*)\\s*==\\s*auth\\.${escapeForRegExp(principalKey)}$`);

export function buildAclExpression(security?: FieldSecurity): string | undefined {
  if (!security) return undefined;
  const principalKey = security.principalKey ?? DEFAULT_PRINCIPAL_KEY;

  switch (security.mode) {
    case "everyone":
      return undefined;
    case "authenticated":
      return authenticatedExpression(principalKey);
    case "owner": {
      const ownerField = security.ownerField?.trim();
      // Without a chosen owner field there is no canonical expression to emit;
      // the caller keeps whatever custom expression the user had instead.
      if (!ownerField) return undefined;
      return `document.${ownerField} == auth.${principalKey}`;
    }
    case "custom": {
      const expression = security.expression?.trim();
      return expression ? expression : undefined;
    }
    default:
      return undefined;
  }
}

export function inferSecurityFromAcl(acl: string | undefined, principalKey?: string): FieldSecurity {
  const key = principalKey ?? DEFAULT_PRINCIPAL_KEY;
  const carried = principalKey ? {principalKey} : {};
  const expression = acl?.trim();
  if (!expression) return {mode: "everyone", expression: "", ...carried};

  if (expression === authenticatedExpression(key)) {
    return {mode: "authenticated", expression, ...carried};
  }

  const ownerMatch = expression.match(ownerExpressionPattern(key));
  if (ownerMatch) {
    return {mode: "owner", expression, ownerField: ownerMatch[1], ...carried};
  }

  return {mode: "custom", expression, ...carried};
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
