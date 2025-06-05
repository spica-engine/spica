import {ObjectId} from "@spica-server/database";
import {FactorMeta} from "@spica-server/interface/passport/authfactor";

export interface IdentitySettingsContents {
  schema: IdentitySchema;
}

export interface IdentitySchema {
  attributes: {
    [key: string]: any;
  };
}

export interface Identity {
  _id?: ObjectId;
  identifier: string;
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
}

export interface LoginCredentials {
  identifier: string;
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

export interface IdentityOptions {
  expiresIn: number;
  maxExpiresIn: number;
  issuer: string;
  audience?: string;
  secretOrKey: string;
  defaultIdentityIdentifier?: string;
  defaultIdentityPassword?: string;
  defaultIdentityPolicies?: string[];
  entryLimit?: number;
  blockingOptions: {
    failedAttemptLimit: number;
    blockDurationMinutes: number;
  };
  refreshTokenExpiresIn?: number;
  passwordHistoryUniquenessCount: number;
}

export const IDENTITY_OPTIONS = Symbol.for("IDENTITY_OPTIONS");
export const POLICY_PROVIDER = Symbol.for("POLICY_PROVIDER");
