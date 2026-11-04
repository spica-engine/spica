import {quote} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {compileRule, RuleScope} from "./rule/index.js";

export interface ConditionalField {
  property: string;
  column: string;
  sql: string;
}

export interface CompiledFieldRules {
  hidden: string[];
  conditional: ConditionalField[];
  joins: string[];
}

export function fieldRulesOf(bucket: Bucket): [property: string, rule: string][] {
  const properties = (bucket.properties ?? {}) as Record<string, {acl?: string}>;
  return Object.entries(properties).flatMap(([property, {acl}]) =>
    acl ? [[property, acl] as [string, string]] : []
  );
}

/**
 * A field without a rule, or with a rule that always holds, is not listed. A rule that never holds
 * hides the field for everybody. Any other rule becomes a flag that the row has to carry.
 */
export function compileFieldRules(scope: RuleScope, values: unknown[]): CompiledFieldRules {
  const hidden: string[] = [];
  const conditional: ConditionalField[] = [];
  const joins: string[] = [];

  for (const [property, rule] of fieldRulesOf(scope.bucket)) {
    const compiled = compileRule(rule, scope, values);
    if (compiled.constant === false) {
      hidden.push(property);
    } else if (compiled.constant === undefined) {
      conditional.push({property, column: `_visible_${conditional.length}`, sql: compiled.sql});
      joins.push(...compiled.joins.filter(join => !joins.includes(join)));
    }
  }
  return {hidden, conditional, joins};
}

export function visibilitySelect(rules: CompiledFieldRules): string[] {
  return rules.conditional.map(({sql, column}) => `COALESCE(${sql}, FALSE) AS ${quote(column)}`);
}

export function applyVisibility<T extends Record<string, unknown>>(
  document: T,
  row: Record<string, unknown>,
  rules: CompiledFieldRules
): T {
  const result = {...document};
  for (const property of rules.hidden) {
    delete result[property];
  }
  for (const {property, column} of rules.conditional) {
    if (row[column] !== true) {
      delete result[property];
    }
  }
  return result;
}
