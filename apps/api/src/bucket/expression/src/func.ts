import {FunctionContext, Func, Mode} from "../../../../../../libs/interface/bucket/expression";

let funcs = new Map<string, Func>();

export function register(name: string, func: Func) {
  funcs.set(name, func);
}

export function has(name: string) {
  return funcs.has(name);
}

export function visit(name: string, ctx: FunctionContext, mode: Mode) {
  const func = funcs.get(name);
  if (!func) {
    throw new Error(`func registry has no func named "${name}"`);
  }
  return func(ctx, mode);
}
