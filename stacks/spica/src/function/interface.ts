import {InjectionToken} from "@angular/core";
import {JSONSchema7} from "json-schema";

export interface FunctionOptions {
  url: string;
}

export const FUNCTION_OPTIONS = new InjectionToken<FunctionOptions>("FUNCTION_OPTIONS");

export interface FunctionDescription {
  _id?: string;
  name: string;
  description: string;
  memoryLimit?: number;
  timeout?: number;
}

export interface NormalizedFunction extends FunctionDescription {
  triggers: Trigger[];
  env: Environment[];
}

export interface Function extends FunctionDescription {
  triggers: {
    [key: string]: TriggerDescription;
  };
  env: {
    [key: string]: string;
  };
}

export interface Trigger extends TriggerDescription {
  handler: string;
}

export interface TriggerDescription<T = any> {
  type: string;
  active?: boolean;
  options: T;
}

export interface Environment {
  name: string;
  value: string;
}

export interface Dependency {
  name: string;
  version: string;
}

export function emptyFunction(): NormalizedFunction {
  return {
    name: undefined,
    description: undefined,
    triggers: [emptyTrigger("default")],
    env: []
  };
}

export function emptyTrigger(handler?: string): Trigger {
  return {
    handler: handler,
    options: {},
    type: undefined,
    active: true
  };
}

export function normalizeFunction(fn: Function): NormalizedFunction {
  const {triggers, env, ...fnDescription} = fn;
  return {
    ...fnDescription,
    triggers: Object.keys(triggers).reduce((acc, handler) => {
      acc.push({...triggers[handler], handler});
      return acc;
    }, new Array<Trigger>()),
    env: Object.keys(env).reduce((acc, name) => {
      acc.push({name, value: env[name]});
      return acc;
    }, new Array<Environment>())
  };
}

export function denormalizeFunction(fn: NormalizedFunction): Function {
  const {triggers, env, ...fnDescription} = fn;
  return {
    ...fnDescription,
    triggers: triggers.reduce(
      (acc, trigger) => {
        const {handler, ...triggerDescription} = trigger;
        acc[handler] = triggerDescription;
        return acc;
      },
      {default: undefined}
    ),
    env: env.reduce((acc, env) => {
      acc[env.name] = env.value;
      return acc;
    }, {})
  };
}

export interface LogFilter {
  functions: string[];
  begin?: Date;
  end?: Date;
}

export interface Log {
  _id: string;
  function: string;
  event_id: string;
  content: string;
  channel: "stderr" | "stdout";
  created_at: string;
}

export interface Webhook {
  _id?: string;
  url: string;
  body: string;
  trigger: WebhookTrigger;
}

export interface WebhookTrigger {
  name: string;
  active: boolean;
  options: {
    collection: string;
    type: "INSERT" | "UPDATE" | "REPLACE" | "DELETE";
  };
}

export function emptyWebhook(): Webhook {
  return {
    url: undefined,
    body: "{{{ toJSON this }}}",
    trigger: {active: true, name: "database", options: {collection: undefined, type: undefined}}
  };
}

export interface WebhookLog {
  _id: string;
  webhook: string;
  request: object;
  response: object;
  execution_time: Date;
}

export interface WebhookLogFilter {
  webhooks: string[];
  statusCodes: number[];
  date: {
    begin: Date;
    end: Date;
  };
  limit: number;
  skip: number;
}

export interface Enqueuer {
  description: {
    icon: string;
    name: string;
    title: string;
    description: string;
  };
  options: JSONSchema7;
}

export interface Information {
  enqueuers: Enqueuer[];
}
