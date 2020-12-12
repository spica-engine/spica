import {ObjectId} from "@spica-server/database";

export interface Function {
  _id?: string | ObjectId;
  name?: string;
  description?: string;
  env: Environment;
  triggers: Triggers;
  timeout: number;
  language: string;
}

export interface Triggers {
  [key: string]: Trigger;
}

export interface Trigger {
  type: string;
  active?: boolean;
  batch?: {
    limit: number;
    deadline: number;
  };
  options: unknown;
}

export interface Environment {
  [key: string]: string;
}

export interface Dependency {
  [key: string]: string;
}
