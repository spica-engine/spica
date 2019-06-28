import {Rule, Source, SourceContext} from "../interface";

type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;

export function callRule<T, R>(rule: Rule<T, R>, ...args: ArgumentTypes<typeof rule>): R {
  const result = rule(...args);
  if (typeof result === "function") {
    return callRule(result as Rule<T, R>, ...args);
  } else {
    return result;
  }
}

export function callSource<R>(source: Source<R>, context: SourceContext): R {
  return source(context);
}
