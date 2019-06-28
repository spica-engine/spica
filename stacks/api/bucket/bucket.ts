import {ObjectId} from "@spica-server/database";
import {Preference} from "@spica-server/preference";
import {JSONSchema7, JSONSchema7TypeName} from "json-schema";

export interface Bucket {
  _id?: ObjectId;
  title?: string;
  icon?: string;
  description?: string;
  primary: string;
  properties?: {
    [key: string]: JSONSchema7 & PropertyOptions;
  };
}

interface PropertyOptions {
  type: JSONSchema7TypeName | JSONSchema7TypeName[] | string;
  options: {
    visible?: boolean;
    translate?: boolean;
    history?: boolean;
    position: "left" | "right" | "bottom";
  };
}

export interface BucketEntry {
  _id?: ObjectId;
  [key: string]: any | undefined;
}

export interface BucketPreferences extends Preference {
  _id?: any;
  language: {
    // TODO(tolga): use map like array
    supported_languages: Array<{
      code: string;
      name: string;
    }>;
    default: {
      code: string;
      name: string;
    };
  };
}

export interface ImportFile {
  content: {
    data: Buffer;
    type: string;
    size?: number;
  };
}
