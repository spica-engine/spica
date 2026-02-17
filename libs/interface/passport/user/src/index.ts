import {ObjectId} from "@spica-server/database";
import {FactorMeta} from "@spica-server/interface/passport/authfactor";

export interface User {
  _id?: ObjectId;
  username: string;
  password: string;
  deactivateJwtsBefore?: number;
  policies: string[];
  authFactor?: FactorMeta;
  lastPasswords: string[];
  lastLogin: Date;
  failedAttempts: Date[];
  bannedUntil?: Date;
  email?: EncryptableField;
  phone?: EncryptableField;
}

export interface LoginCredentials {
  username: string;
  password: string;
  state?: string;
  expires?: number;
}

export interface Service {
  $resource: string;
  $format?: string;
  title: string;
  actions: string[];
}

export interface PaginationResponse<T> {
  meta: {total: number};
  data: T[];
}

export interface UserOptions {
  expiresIn: number;
  maxExpiresIn: number;
  issuer: string;
  audience?: string;
  secretOrKey: string;
  entryLimit?: number;
  blockingOptions: {
    failedAttemptLimit: number;
    blockDurationMinutes: number;
  };
  refreshTokenExpiresIn?: number;
  refreshTokenHashSecret?: string;
  verificationCodeExpiresIn?: number;
  passwordHistoryLimit: number;
  userRealtime: boolean;
  verificationHashSecret?: string;
  providerEncryptionSecret?: string;
  providerHashSecret?: string;
}

export interface UserVerification {
  userId: ObjectId;
  destination: string;
  attempts: number;
  code: string;
  strategy: string;
  purpose: string;
  is_used: boolean;
  requestCount?: number;
}

export interface UserConfigSettings {
  verificationProcessMaxAttempt: number;
  passwordlessLogin?: PasswordlessLoginConfig;
  resetPasswordProvider?: Array<{
    provider: "email" | "phone";
    strategy: string;
  }>;
}
export interface PasswordlessLoginConfig {
  passwordlessLoginProvider: Array<{
    provider: "email" | "phone";
    strategy: string;
  }>;
}
export const USER_OPTIONS = Symbol.for("USER_OPTIONS");
export const POLICY_PROVIDER = Symbol.for("POLICY_PROVIDER");

export type EncryptedData = {
  encrypted: string;
  iv: string;
  authTag: string;
};

export type EncryptedDataWithHash = EncryptedData & {hash?: string};

type DecryptedData = {
  value: string;
};

type EncryptableField = {
  createdAt: Date;
} & (DecryptedData | EncryptedDataWithHash);

export type DecryptedUser = User & {
  email?: {value: string; createdAt: Date};
  phone?: {value: string; createdAt: Date};
};

export type UserSelfUpdate = Pick<User, "password">;
