import {parser} from "./parser.js";
import {compile} from "./compile.js";
import {convert, convertWithReplacers, applyReplacersToAst} from "./convert.js";
import {extract} from "./property_map.js";
import * as func from "./func.js";
import * as builtin from "./builtin_funcs.js";
import {Mode, Replacer} from "@spica-server/interface-bucket-expression";

export {
  isSelectOperator,
  isStringLiteral,
  getSelectPath,
  getFieldSideAndValueSide
} from "./convert.js";

export function run(expression: string, context: unknown, mode: Mode) {
  const tree = parser.parse(expression);
  const rule = compile(tree, mode);
  return rule(context);
}

export function runWithReplacers(
  expression: string,
  context: unknown,
  mode: Mode,
  customReplacers: Replacer[]
) {
  const tree = parser.parse(expression);
  applyReplacersToAst(tree, customReplacers);
  const rule = compile(tree, mode);
  return rule(context);
}

/**
 * **Parses the expression, applies the replacers and returns the AST** — without converting it to a target.
 *
 * `aggregateWithReplacers` does the same job and converts to a Mongo `$match`; `runWithReplacers` compiles
 * to a JS predicate. There is a third consumer: the neutral `ReadPlan`. Its `filter`/`acl` fields want the
 * contract's `Expression` tree, so "one language, N compilers" requires access to the expression in its
 * **unconverted** form.
 *
 * The replacers are applied here too and that is essential: typed fields (hash, encrypted, date) rewrite
 * the expression and that rewriting is part of the semantics — skipped, the PG leg would compare the raw
 * value.
 */
export function astWithReplacers(expression: string, customReplacers: Replacer[]) {
  const tree = parser.parse(expression);
  applyReplacersToAst(tree, customReplacers);
  return tree;
}

export function aggregate(expression: string, context: unknown, mode: Mode) {
  const tree = parser.parse(expression);
  const result = convert(tree, mode);
  return result(context);
}

/**
 * An expression → the Mongo `$match` body, for a `filter` query parameter that carries no schema.
 *
 * `aggregate(…, "match")` needs a schema only for the replacers (relation ids, dates, hashed fields), and
 * the management endpoints have none: their filters are equality, comparison and `regex()` over plain
 * columns. So the conversion happens in the pipe and everything downstream keeps receiving a filter
 * object — `PipelineBuilder.filterByUserRequest` and `ICollection.find` do not learn a second shape.
 *
 * This is K-13's other half. `bucket/:id/data` returns the expression **unconverted** on purpose
 * (`expressionFilterParser`), because it converts later with the bucket's replacers.
 */
export function filterToMatch(expression: string): object {
  return aggregate(expression, {}, "match");
}

export function aggregateWithReplacers(
  expression: string,
  context: unknown,
  mode: Mode,
  customReplacers: Replacer[]
) {
  const tree = parser.parse(expression);
  const result = convertWithReplacers(tree, mode, customReplacers);
  return result(context);
}

export function extractPropertyMap(expression: string) {
  const tree = parser.parse(expression);
  return extract(tree);
}

// object
func.register("has", builtin.has);

// array comparison
func.register("some", builtin.some);
func.register("every", builtin.every);
func.register("equal", builtin.equal);

// string
func.register("regex", builtin.regex);

// iterables
func.register("length", builtin.length);

// date
func.register("unixTime", builtin.unixTime);
func.register("now", builtin.now);
