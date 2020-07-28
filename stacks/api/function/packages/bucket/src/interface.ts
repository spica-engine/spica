import {JSONSchema7, JSONSchema7TypeName} from "json-schema";

export interface Bucket {
  _id?: string;
  title: string;
  icon?: string;
  description: string;
  primary: string;
  history?: boolean;
  properties: {
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
  _id?: string;
  [key: string]: any | undefined;
}

export interface IndexResult<T> {
  meta: {
    total: number;
  };
  data: T[];
}
