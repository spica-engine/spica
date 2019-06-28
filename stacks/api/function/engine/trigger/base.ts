import {SetMetadata} from "@nestjs/common";
import {JSONSchema6} from "json-schema";

export const TRIGGER_METADATA = "engineTrigger";

export const Trigger = (options: TriggerMetadata) => SetMetadata(TRIGGER_METADATA, options);

export interface TriggerMetadata {
  name: string;
  flags?: TriggerFlags;
}

export const enum TriggerFlags {
  NotSubscribable = 1 << 0
}

/**
 * If register function called with an null invoker
 * that means the function begin deleted from system.
 * In this case triggers should run a clean up operation
 */
export interface Trigger<OptionsT = object> {
  register(invoker: InvokerFn | null, target: Target, options: OptionsT): any;
  schema(): Promise<TriggerSchema>;
  declarations(): Promise<string>;
  stub?(test: any, info: Function): Promise<any[]>;
  runSchema?(options: OptionsT): Promise<RunSchema>;
}

export interface RunSchema extends JSONSchema6 {}

export interface TriggerSchema extends JSONSchema6 {}

export interface Target {
  id: string;
  handler: string;
}
export type InvokerFn = (invocation: Invocation) => Promise<any>;

export interface Invocation {
  target: Target;
  parameters: any[];
}

export interface Token {
  [key: string]: any;
}

export interface Context {
  [key: string]: any;
}
