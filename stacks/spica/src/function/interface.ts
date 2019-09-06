import {InjectionToken} from "@angular/core";

export interface FunctionOptions {
  url: string;
}

export const FUNCTION_OPTIONS = new InjectionToken<FunctionOptions>("FUNCTION_OPTIONS");

export interface Function {
  _id?: string;
  name: string;
  description: string;
  triggers: Triggers;
  dependencies?: Dependency;
  env?: Environment[];
  flags?: FunctionFlags;
  memoryLimit?: number;
  timeout?: number;
}

export enum FunctionFlags {
  Editable = 1
}

export interface Environment {
  name: string;
  value: string | number | boolean;
}

export interface Dependency {
  [key: string]: string;
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

export function emptyFunction(): Function {
  return {
    name: undefined,
    description: undefined,
    triggers: {default: {type: undefined, active: true, options: {}}},
    env: [],
    flags: FunctionFlags.Editable
  };
}

export interface LogFilter {
  begin: string;
  end: string;
  order?: string;
}

export interface Subscription {
  _id?: string;
  trigger: Trigger;
  url: string;
}

export interface Trigger<T = any> {
  type: string;
  options: T | any;
}

export function emptySubscription(): Subscription {
  return {trigger: {type: undefined, options: {}}, url: undefined};
}
