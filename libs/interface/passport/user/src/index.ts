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
  banned_until?: Date;
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
  passwordHistoryLimit: number;
  userRealtime: boolean;
}

export const USER_OPTIONS = Symbol.for("USER_OPTIONS");
export const POLICY_PROVIDER = Symbol.for("POLICY_PROVIDER");
