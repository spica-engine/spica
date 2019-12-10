import {ObjectId} from "@spica-server/database";

export const FUNCTION_OPTIONS = "FUNCTION_OPTIONS";

export interface Options {
  root: string;
}

export interface Function {
  _id?: string | ObjectId;
  name?: string;
  description?: string;
  env?: Environment;
  triggers: Triggers;
  memoryLimit?: number;
  timeout?: number;
}

export interface Triggers {
  default: Trigger;
  [key: string]: Trigger;
}

export interface Trigger {
  type: string;
  active?: boolean;
  options: any;
}

export interface Environment {
  [key: string]: string;
}

export interface Dependency {
  [key: string]: string;
}
