import {ObjectId} from "@spica-server/database";
import {FactorMeta} from "@spica-server/interface/passport/authfactor";

export interface UserSettingsContents {
  schema: UserSchema;
}

export interface UserSchema {
  attributes: {
    [key: string]: any;
  };
}

export interface User {
  _id?: ObjectId;
  username: string;
  password: string;
  deactivateJwtsBefore?: number;
  policies: string[];
  attributes?: {
    [key: string]: any;
  };
  authFactor?: FactorMeta;
  lastPasswords: string[];
  lastLogin: Date;
  failedAttempts: Date[];
  bannedUntil?: Date;
  email?: {
    value: string;
    createdAt: Date;
  };
  phone?: {
    value: string;
    createdAt: Date;
  };
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
  defaultUserUsername?: string;
  defaultUserPassword?: string;
  defaultUserPolicies?: string[];
  entryLimit?: number;
  blockingOptions: {
    failedAttemptLimit: number;
    blockDurationMinutes: number;
  };
  refreshTokenExpiresIn?: number;
  verificationCodeExpiresIn?: number;
  passwordHistoryLimit: number;
  userRealtime: boolean;
  hashSecret?: string;
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
}
export const USER_OPTIONS = Symbol.for("USER_OPTIONS");
export const POLICY_PROVIDER = Symbol.for("POLICY_PROVIDER");
