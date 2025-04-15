import {FunctionContext, Func} from "@spica-server/interface/bucket/expression";

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
