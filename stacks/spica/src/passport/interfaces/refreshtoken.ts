import {JSONSchema7TypeName} from "json-schema";
import {InputSchema} from "@spica-client/common";
export interface RefreshToken {
  _id?: string;
  token: string;
  created_at: Date;
  expired_at: Date;
  identity: string;
}

export interface RefreshTokenSchema {
  properties: {
    [key: string]: Property;
  };
}

export interface FilterSchema {
  properties: {
    [key: string]: Property;
  };
}

export interface PropertyOptions {
  type: JSONSchema7TypeName | JSONSchema7TypeName[] | string;
}

export type Property = InputSchema & PropertyOptions;
