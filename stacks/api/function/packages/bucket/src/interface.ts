import {JSONSchema7, JSONSchema7TypeName} from "json-schema";

export interface Bucket {
  title?: string;
  icon?: string;
  description?: string;
  primary: string;
  history?: boolean;
  properties?: {
    [key: string]: JSONSchema7 & PropertyOptions;
  };
  order?: number;
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

export interface BucketDocument {
  [key: string]: any | undefined;
}
