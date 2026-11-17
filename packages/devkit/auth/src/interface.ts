export interface SignUpStrategy {
  /** @deprecated Read the key with idOf; it is named id on PostgreSQL. */
  _id?: string;
  title: string;
  type: string;
}

interface User {
  /** @deprecated Read the key with idOf; it is named id on PostgreSQL. */
  _id?: string;
  username: string;
  password: string;
  policies: string[];
  lastLogin?: Date;
  failedAttempts?: Date[];
  signUpStrategy?: SignUpStrategy;
}

export type UserCreate = Omit<
  User,
  "_id" | "lastLogin" | "failedAttempts" | "policies" | "signUpStrategy"
>;
export type UserGet = Omit<User, "password">;
export type UserUpdate = Pick<User, "password">;

export type TokenScheme = {token: string};

export type VerificationStrategy = "Otp" | "MagicLink";

export type Provider = "email" | "phone";

export interface VerificationStartResponse {
  message: string;
  value: string;
  metadata: Record<string, any>;
}

export interface VerificationCompleteResponse {
  message: string;
  provider: string;
  destination: string;
}

export interface PasswordResetStartResponse {
  message: string;
}

export interface PasswordResetCompleteResponse {
  message: string;
}

export interface PasswordlessLoginStartResponse {
  message: string;
  metadata?: Record<string, any>;
}

export interface PasswordlessLoginCompleteResponse {
  token: string;
  scheme: string;
  issuer: string;
}

export interface VerifiedToken {
  /** @deprecated Read the key with idOf; it is named id on PostgreSQL. */
  _id?: string;
  username: string;
  [key: string]: any;
}
