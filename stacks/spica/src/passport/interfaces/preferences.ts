import {PreferencesMeta} from "@spica-client/core";
import {JSONSchema7TypeName} from "json-schema";
import {InputSchema} from "@spica-client/common";

export interface PassportPreference extends PreferencesMeta {
  identity: {
    attributes: {
      required: string[];
      properties: {
        [key: string]: Property;
      };
    };
  };
}

export interface PropertyOptions {
  type: JSONSchema7TypeName | JSONSchema7TypeName[] | string;
  options?: {
    [key: string]: string;
  };
}

export type Property = InputSchema & PropertyOptions;
