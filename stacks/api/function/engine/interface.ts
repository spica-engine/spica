import {Context, Target, Info} from "./trigger/base";
import {Logger} from "./logger";

export interface Execution {
  id?: string;
  target?: Target;
  logger: Logger;
  cwd: string;
  script: string;
  context: Context;
  parameters: any[];
  modules?: {
    [key: string]: object;
  };
  memoryLimit: number;
  timeout: number;
}

export interface Function {
  _id?: string;
  env?: Environment;
  triggers: Triggers;
  memoryLimit?: number;
  timeout?: number;
}

export interface Subscription {
  _id: string;
  trigger: Trigger;
  url: string;
}

export interface FunctionInfo {
  [key: string]: Info[];
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
