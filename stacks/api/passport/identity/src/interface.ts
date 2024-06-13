import {ObjectId} from "@spica-server/database";
import {FactorMeta} from "@spica-server/passport/authfactor";

export interface Identity {
  _id?: ObjectId;
  identifier: string;
  password: string;
  policies: string[];
  attributes?: {
    [key: string]: any;
  };
  authFactor?: FactorMeta;
  lastLogin: Date;
  failedAttempts: Date[];
  lastPasswords: string[];
  refreshTokens: RefreshToken[];
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

export interface RefreshToken {
  token: string;
  userAgent: string;
  createdAt: Date;
  expiresIn: Date;
}
