export interface Function {
  _id?: any;
  name: string;
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
  options: unknown;
}

export interface Environment {
  [key: string]: string;
}

export interface Dependency {
  [key: string]: string;
}
