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

export interface Identity {
  _id?: string;
  identifier: string;
  password: string;
  policies: string[];
  attributes?: {
    [key: string]: any;
  };
  system?: boolean;
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
