import {Rule, Source, SourceContext} from "../interface";
import {callRule, callSource} from "./call";

/**
 * Run rule and pass it return value to the next rule.
 * @returns Rule
 */
export function chain<A, B>(): Rule<A, B>;
export function chain<A, B>(r1: Rule<A, B>): Rule<A, B>;
export function chain<A, B, C>(r1: Rule<A, B>, r2: Rule<B, C>): Rule<A, C>;
export function chain<A, B, C, D>(r1: Rule<A, B>, r2: Rule<B, C>, r3: Rule<C, D>): Rule<A, D>;
export function chain<A, B, C, D, E>(
  r1: Rule<A, B>,
  r2: Rule<B, C>,
  r3: Rule<C, D>,
  r4: Rule<D, E>
): Rule<A, E>;
export function chain<A, B, C, D, E, F>(
  r1: Rule<A, B>,
  r2: Rule<B, C>,
  r3: Rule<C, D>,
  r4: Rule<D, E>,
  r5: Rule<E, F>
): Rule<A, F>;
export function chain<A, B, C, D, E, F, G>(
  r1: Rule<A, B>,
  r2: Rule<B, C>,
  r3: Rule<C, D>,
  r4: Rule<D, E>,
  r5: Rule<E, F>,
  r6: Rule<F, E>
): Rule<A, E>;
export function chain<A, B, C, D, E, F, G, H>(
  r1: Rule<A, B>,
  r2: Rule<B, C>,
  r3: Rule<C, D>,
  r4: Rule<D, E>,
  r5: Rule<E, F>,
  r6: Rule<F, G>,
  r7: Rule<G, H>
): Rule<A, H>;
export function chain<A, B, C, D, E, F, G, H, I>(
  r1: Rule<A, B>,
  r2: Rule<B, C>,
  r3: Rule<C, D>,
  r4: Rule<D, E>,
  r5: Rule<E, F>,
  r6: Rule<F, G>,
  r7: Rule<G, H>,
  r8: Rule<H, I>,
  ...rules: Rule<I>[]
): Rule<A>;
export function chain(...rules: Array<Rule<any, any>>): Rule<any, any> {
  return (node, ctx) => rules.reduce((node, rule) => (node = callRule(rule, node, ctx)), node);
}

/**
 * Accepts array of rules in unsafe typechecking manner.
 * Same as chain but it accepts an array directly since typescript doesn't support tuple types in spread operator.
 */
export function zip(rules: Array<Rule<any, any>>): Rule<any, any> {
  return (node, ctx) => rules.reduce((node, rule) => (node = callRule(rule, node, ctx)), node);
}

/**
 * Apply multiple rules to a source, and returns the source transformed.
 * @returns Rule
 */
export function apply<T, R>(source: Source<T>, rule: Rule<T, R>): Rule<T, R> {
  return (_, context: SourceContext) => {
    return callRule(rule, callSource(source, context), context);
  };
}

/**
 * Run rules conditionally
 * @returns Rule
 */
export function when<T, R>(
  predicate: (node: T) => boolean,
  iif: Rule<T, R>,
  eelse: Rule<T, R>
): Rule<T, R>;
export function when<T, R>(
  predicate: (node: T) => node is T,
  iif: Rule<T, R>,
  eelse: Rule<T, R>
): Rule<T, R> {
  return node => {
    return predicate(node) ? iif : eelse;
  };
}

/**
 * Run prepare rules to find target node, and apply rules and return original node;
 */
export function prepare<A, B>(prepare: Rule<A, B>, rule: Rule<B>): Rule<A, A> {
  return (node, context) => {
    callRule(rule, callRule(prepare, node, context), context);
    return node;
  };
}

/**
 * Merges rules individually and returns their return values as a collection
 * @returns Rule
 */
export function forkJoin<A, B>(r1: Rule<A, B>): Rule<A, [A]>;
export function forkJoin<A, B, C>(r1: Rule<A, B>, r2: Rule<A, C>): Rule<A, [B, C]>;
export function forkJoin<A, B, C, D>(
  r1: Rule<A, B>,
  r2: Rule<A, C>,
  r3: Rule<A, D>
): Rule<A, [B, C, D]>;
export function forkJoin<A, B, C, D, E>(
  r1: Rule<A, B>,
  r2: Rule<A, C>,
  r3: Rule<A, D>,
  r4: Rule<A, E>
): Rule<A, [B, C, D, E]>;
export function forkJoin<A>(...rules: Rule<A, any>[]): Rule<A, any[]> {
  return (node, ctx) => rules.map(r => callRule(r, node, ctx));
}

/**
 * Call a callback for each element and run rules seperately but do not take their return values
 * @returns Rule
 */
export function forEach<P, T>(
  elements: ReadonlyArray<T>,
  callback: (element: T) => Rule<P, unknown>
): Rule<P, void> {
  return (node, ctx) => elements.forEach(element => callRule(callback(element), node, ctx));
}

/**
 * Run rule with no side effects.
 */
export function ignoreElements<A, B>(rule: Rule<A, B>): Rule<A, A> {
  return (node, ctx) => {
    callRule(rule, node, ctx);
    return node;
  };
}

/**
 * A rule that does nothing.
 * @returns Rule
 */
export function noop<A>(): Rule<A, A> {
  return node => node;
}

/**
 * A rule that changes return type to void
 * @returns Rule
 */
export function vvoid<A>(): Rule<A, void> {
  return () => void 0;
}
