import {parser} from "./parser";
import {compile} from "./compile";
import {convert, convertWithReplacers, applyReplacersToAst} from "./convert";
import {extract} from "./property_map";
import * as func from "./func";
import * as builtin from "./builtin_funcs";
import {Mode, Replacer} from "@spica-server/interface/bucket/expression";

export {isSelectOperator, isStringLiteral, getSelectPath} from "./convert";

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

export function aggregate(expression: string, context: unknown, mode: Mode) {
  const tree = parser.parse(expression);
  const result = convert(tree, mode);
  return result(context);
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
