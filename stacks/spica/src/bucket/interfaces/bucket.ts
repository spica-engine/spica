import {InputSchema} from "@spica-client/common";
import {JSONSchema7TypeName} from "json-schema";

export interface Bucket {
  _id?: string;
  primary: string;
  title?: string;
  order?: number;
  icon?: string;
  readOnly?: boolean;
  description?: string;
  required?: string[];
  properties?: {
    [key: string]: Property;
  };
}

export interface PropertyOptions {
  type: JSONSchema7TypeName | JSONSchema7TypeName[] | string;
  options?: {
    visible?: boolean;
    translate?: boolean;
    history?: boolean;
    position: "left" | "right" | "bottom";
  };
}

export type Property = InputSchema & PropertyOptions;

export function emptyBucket(): Bucket {
  return {
    title: undefined,
    description: undefined,
    icon: "view_stream",
    primary: undefined,
    readOnly: false,
    properties: {
      title: {
        type: "string",
        title: "title",
        description: "Title of the row",
        options: {
          position: "left"
        }
      },
      description: {
        type: "textarea",
        title: "description",
        description: "Description of the row",
        options: {
          position: "right"
        }
      }
    }
  };
}

export interface BucketTemplate {
  $id: string;
  name: string;
  buckets: Bucket[];
}
