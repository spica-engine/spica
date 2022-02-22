import {parser} from "./parser";
import {compile} from "./compile";
import {convert} from "./convert";
import {extract} from "./property_map";
import * as func from "./func";
import * as builtin from "./builtin_funcs";

export function run(expression: string, context: unknown) {
  const tree = parser.parse(expression);
  const rule = compile(tree);
  return rule(context);
}

export function aggregate(expression: string, context: unknown) {
  const tree = parser.parse(expression);
  const result = convert(tree);
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
