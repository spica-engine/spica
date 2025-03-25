import {ObjectId, CreateIndexesOptions} from "@spica-server/database";
import {Preference} from "@spica-server/preference/services";
import {JSONSchema7, JSONSchema7TypeName} from "json-schema";

export interface IndexDefinition {
  definition: {
    [key: string]: any;
  };
  options?: CreateIndexesOptions;
}

export interface ExistingIndex {
  v: number;
  key: {
    [key: string]: any;
  };
  name: string;
  [key: string]: any;
}

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

export type ExtendedJSONSchema7Type =
  | JSONSchema7["type"]
  | "objectid"
  | "storage"
  | "richtext"
  | "textarea"
  | "color"
  | "multiselect"
  | "relation"
  | "date"
  | "location"
  | "json";

export const BUCKET_DATA_LIMIT = Symbol.for("BUCKET_DATA_LIMIT");
