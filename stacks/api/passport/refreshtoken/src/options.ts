export const REFRESHTOKEN_OPTIONS = Symbol.for("REFRESHTOKEN_OPTIONS");

export interface RefreshTokenOptions {
  refreshTokenExpiresIn: number;
}
