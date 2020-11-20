import {InputSchema} from "@spica-client/common";
import {JSONSchema7TypeName} from "json-schema";

export interface Bucket {
  _id?: string;
  primary: string;
  title?: string;
  order?: number;
  icon?: string;
  history?: boolean;
  readOnly?: boolean;
  description?: string;
  required?: string[];
  properties?: {
    [key: string]: Property;
  };
  acl: {
    read: string;
    write: string;
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
    title: "New Bucket",
    description: "Describe your new bucket",
    icon: "view_stream",
    primary: "title",
    readOnly: false,
    history: false,
    properties: {
      title: {
        type: "string",
        title: "title",
        description: "Title of the row",
        options: {
          position: "left",
          visible: true
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
    },
    acl: {
      write: "true==true",
      read: "true==true"
    }
  };
}

export interface BucketTemplate {
  $id: string;
  name: string;
  buckets: Bucket[];
}
