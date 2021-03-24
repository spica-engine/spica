import {parser} from "../expression/src/parser";

export function expressionFilterParser(exp) {
  const tree = parser.parse(exp);
  // we should parse expression which is sent in string format
  if (tree.kind == "literal" && tree.type == "string") {
    return tree.value;
  }

  return exp;
}
