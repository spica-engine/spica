import { parser } from "./parser";
import { compile } from "./compiler";

export function run(expression, context) {
    const tree = parser.parse(expression);
    const rule = compile(tree);
    return rule(context);
}