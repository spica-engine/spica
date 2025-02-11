import {ObjectId} from "@spica-server/database";
import {FactorMeta} from "@spica-server/passport/authfactor";

export interface Identity {
  _id?: ObjectId;
  identifier: string;
  password: string;
  deactivateJwtsBefore: number;
  policies: string[];
  attributes?: {
    [key: string]: any;
  };
  authFactor?: FactorMeta;
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
