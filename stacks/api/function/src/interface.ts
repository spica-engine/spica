import {ObjectId} from "@spica-server/database";


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
  [key: string]: Trigger;
}

export interface Trigger {
  type: string;
  active?: boolean;
  options: unknown;
}

export interface Environment {
  [key: string]: string;
}

export interface Dependency {
  [key: string]: string;
}
