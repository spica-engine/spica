import {InjectionToken} from "@angular/core";
import {InputSchema} from "@spica-client/common";
import {JSONSchema7TypeName} from "json-schema";

export interface Bucket {
  _id?: string;
  primary: string;
  title?: string;
  category?: string;
  order?: number;
  icon?: string;
  history?: boolean;
  readOnly?: boolean;
  description?: string;
  required?: string[];
  properties?: {
    [key: string]: Property;
  };
  acl?: {
    read: string;
    write: string;
  };
  documentSettings?: {
    countLimit: number;
    limitExceedBehaviour: LimitExceedBehaviour;
  };
}

export enum LimitExceedBehaviour {
  PREVENT = "prevent",
  REMOVE = "remove"
}

export interface PropertyOptions {
  type: JSONSchema7TypeName | JSONSchema7TypeName[] | string;
  options?: {
    translate?: boolean;
    history?: boolean;
    position: "left" | "right" | "bottom";
    unique?: boolean;
    index?: boolean;
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

// MODULE
export interface BucketOptions {
  url: string;
}
export const BUCKET_OPTIONS = new InjectionToken<BucketOptions>("BUCKET_OPTIONS");
