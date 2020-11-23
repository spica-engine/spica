let funcs = new Map<string, Func>();

export function register(name: string, func: Func) {
  funcs.set(name, func);
}

export function has(name: string) {
  return funcs.has(name);
}

export function visit(name: string, ctx: FunctionContext) {
  const func = funcs.get(name);
  if (!func) {
    throw new Error(`func registry has no func named "${name}"`);
  }
  return func(ctx);
}

export interface FunctionContext {
  receiver: any;
  arguments: any[];
  target: "aggregation" | "default";
}

export type Func = (context: FunctionContext) => (ctx) => unknown;
