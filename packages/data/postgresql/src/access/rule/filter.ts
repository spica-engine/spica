import {CompiledRule, compileParsed, parseRule} from "./compiler.js";
import {InvalidRuleError} from "./errors.js";
import {contextOf, RuleScope} from "./fields.js";

export const FILTER_LIMITS = {length: 4096, depth: 32, terms: 64};

export type FilterScope = Omit<RuleScope, "auth">;

function checkSize(node: unknown) {
  let terms = 0;

  const visit = (value: unknown, depth: number) => {
    if (depth > FILTER_LIMITS.depth) {
      throw new InvalidRuleError(`The filter is nested deeper than ${FILTER_LIMITS.depth} levels.`);
    }
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, depth + 1));
      return;
    }
    if (value === null || typeof value != "object") {
      return;
    }
    if ("kind" in value && ++terms > FILTER_LIMITS.terms) {
      throw new InvalidRuleError(`The filter has more than ${FILTER_LIMITS.terms} terms.`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key != "parent") {
        visit(child, depth + 1);
      }
    }
  };

  visit(node, 0);
}

export function compileFilter(filter: string, scope: FilterScope, values: unknown[]): CompiledRule {
  if (filter.length > FILTER_LIMITS.length) {
    throw new InvalidRuleError(`The filter is longer than ${FILTER_LIMITS.length} characters.`);
  }
  const node = parseRule(filter);
  checkSize(node);
  return compileParsed(node, {...contextOf({...scope, auth: undefined}), forbidAuth: true}, values);
}
