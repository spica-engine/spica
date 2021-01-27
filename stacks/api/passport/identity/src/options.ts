export const IDENTITY_OPTIONS = Symbol.for("IDENTITY_OPTIONS");

export interface IdentityOptions {
  expiresIn: string;
  issuer: string;
  audience?: string;
  secretOrKey: string;
  defaultIdentityIdentifier?: string;
  defaultIdentityPassword?: string;
  defaultIdentityPolicies?: string[];
  identityCountLimit?: number;
}
