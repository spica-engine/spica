import {CompiledRule, compileParsed, parseRule} from "./compiler.js";
import {InvalidRuleError} from "./errors.js";
import {contextOf, FieldResolver, RuleScope} from "./fields.js";

export const FILTER_LIMITS = {length: 4096, depth: 32, terms: 64};

export type FilterScope = Omit<RuleScope, "auth">;

const isTerm = (node: {kind: string; type?: string}) =>
  node.kind == "call" || node.kind == "unary" || (node.kind == "operator" && node.type != "select");

function checkSize(node: unknown) {
  let terms = 0;

  const visit = (value: unknown, depth: number) => {
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, depth));
      return;
    }
    if (value === null || typeof value != "object") {
      return;
    }
    if ("kind" in value) {
      const expression = value as {kind: string; type?: string};
      if (++depth > FILTER_LIMITS.depth) {
        throw new InvalidRuleError(
          `The filter is nested deeper than ${FILTER_LIMITS.depth} levels.`
        );
      }
      if (isTerm(expression) && ++terms > FILTER_LIMITS.terms) {
        throw new InvalidRuleError(`The filter has more than ${FILTER_LIMITS.terms} terms.`);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key != "parent") {
        visit(child, depth);
      }
    }
  };

  visit(node, 0);
}

export function compileFilterIn(
  filter: string,
  fields: FieldResolver,
  values: unknown[],
  now?: () => number,
  hashSecret?: string
): CompiledRule {
  if (filter.length > FILTER_LIMITS.length) {
    throw new InvalidRuleError(`The filter is longer than ${FILTER_LIMITS.length} characters.`);
  }
  const node = parseRule(filter);
  checkSize(node);
  return compileParsed(node, {auth: undefined, forbidAuth: true, now, fields, hashSecret}, values);
}

export function compileFilter(filter: string, scope: FilterScope, values: unknown[]): CompiledRule {
  const {fields, now} = contextOf({...scope, auth: undefined});
  return compileFilterIn(filter, fields, values, now, scope.hashSecret);
}

export function compileFilterNode(node: unknown, scope: FilterScope, values: unknown[]) {
  const {fields, now} = contextOf({...scope, auth: undefined});
  checkSize(node);
  return compileParsed(
    node,
    {auth: undefined, forbidAuth: true, now, fields, hashSecret: scope.hashSecret},
    values
  );
}
