export interface ArgumentValidation {
  validator: (node) => boolean;
  mustBe: string;
}

export interface Replacer {
  condition: (...args) => boolean;
  replace: (...args) => void;
}

export interface FunctionContext {
  receiver: any;
  arguments: any[];
  target: "aggregation" | "default";
}

export type Func = (context: FunctionContext, mode: Mode) => (ctx) => unknown;

export type Mode = "match" | "project";
