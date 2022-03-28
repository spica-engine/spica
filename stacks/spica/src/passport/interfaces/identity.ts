import {JSONSchema7TypeName} from "json-schema";
import {InputSchema} from "@spica-client/common";

export function emptyIdentity(): Identity {
  return {
    identifier: undefined,
    password: undefined,
    policies: [],
    attributes: {}
  };
}

export function emptyAuthFactor(): AuthFactorMeta {
  return {
    type: undefined,
    config: {},
    secret: undefined
  };
}

export interface Identity {
  _id?: string;
  identifier: string;
  password: string;
  policies: string[];
  attributes?: {
    [key: string]: any;
  };
  system?: boolean;
  authFactor?: AuthFactorMeta;
}

export interface AuthFactorMeta {
  type: string;
  config: {
    [key: string]: any;
  };
  secret: string;
}

export interface AuthFactorSchema {
  type: string;
  config: {
    [key: string]: {
      type: string;
      value?: any;
      enum?: any[];
    };
  };
}

export interface AuthFactorGetChallengeResponse {
  challenge: string;
  answerUrl: string;
}

export interface IdentitySchema {
  properties: {
    attributes?: Property;
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
