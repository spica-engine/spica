import {InjectionToken} from "@angular/core";
import {JSONSchema7} from "json-schema";

export interface FunctionOptions {
  url: string;
}

export const FUNCTION_OPTIONS = new InjectionToken<FunctionOptions>("FUNCTION_OPTIONS");
export const WEBSOCKET_INTERCEPTOR = new InjectionToken<FunctionOptions>("WEBSOCKET_INTERCEPTOR");

export interface FunctionDescription {
  _id?: string;
  name: string;
  description: string;
  memoryLimit?: number;
  timeout?: number;
  language: string;
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
  example?:string,
  handler: string;
}

export interface TriggerDescription<T = any> {
  type: string;
  active?: boolean;
  options: T;
}

export interface Environment {
  key: string;
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
    env: [],
    language: "javascript"
  };
}

export function emptyTrigger(handler?: string): Trigger {
  return {
    example: `
export function example(req,res){
  console.log(req);
  return res.status(201).send("OK")
}`,
    handler: handler,
    options: {},
    type: "http",
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
    env: Object.keys(env).reduce((acc, key) => {
      acc.push({key, value: env[key]});
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
    env: env
      .filter(variable => variable.key && variable.value)
      .reduce((acc, env) => {
        acc[env.key] = env.value;
        return acc;
      }, {})
  };
}

export interface LogFilter {
  function: string[];
  begin?: Date;
  end?: Date;
  limit: number;
  sort: {[key: string]: 1 | -1};
}

export interface Log {
  _id: string;
  function: Function | string;
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
  succeed: boolean;
  content: {
    request?: object;
    response?: object;
    error?: string;
  };
  created_at: Date;
}

export interface WebhookLogFilter {
  webhooks: string[];
  succeed: boolean;
  date: {
    begin: Date;
    end: Date;
  };
  limit: number;
  skip: number;
}

export interface Runtime {
  name: string;
  title: string;
  description: string;
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
  runtimes: Runtime[];
  timeout: number;
}
