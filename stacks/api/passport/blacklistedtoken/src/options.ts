export const BLACKLISTEDTOKEN_OPTIONS = Symbol.for("BLACKLISTEDTOKEN_OPTIONS");

export interface BlacklistedTokenOptions {
  refreshTokenExpiresIn: number;
}
