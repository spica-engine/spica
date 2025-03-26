import {ObjectId, CreateIndexesOptions} from "@spica-server/database";
import {Preference} from "@spica-server/interface/preference";
import {JSONSchema7, JSONSchema7TypeName} from "json-schema";

export interface Bucket {
  _id?: ObjectId;
  title?: string;
  icon?: string;
  description?: string;
  primary: string;
  history?: boolean;
  readOnly?: boolean;
  properties?: {
    [key: string]: JSONSchema7 & PropertyOptions;
  };
  order?: number;
  required?: string[];
  acl: {
    read: string;
    write: string;
  };
  documentSettings?: {
    countLimit: number;
    limitExceedBehaviour: LimitExceedBehaviours;
  };
}

export enum LimitExceedBehaviours {
  PREVENT = "prevent",
  REMOVE = "remove"
}

interface PropertyOptions {
  type: JSONSchema7TypeName | JSONSchema7TypeName[] | string;
  options: {
    translate?: boolean;
    history?: boolean;
    position: "left" | "right" | "bottom";
    unique?: boolean;
    index?: boolean;
  };
}

export interface BucketDocument {
  _id?: ObjectId;
  [key: string]: any | undefined;
}

export interface BucketPreferences extends Preference {
  _id?: any;
  language: {
    available: {
      [code: string]: string;
    };
    default: string;
  };
}
