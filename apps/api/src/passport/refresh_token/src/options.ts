export const REFRESH_TOKEN_OPTIONS = Symbol.for("REFRESH_TOKEN_OPTIONS");

export interface RefreshTokenOptions {
  expiresIn: number;
}
