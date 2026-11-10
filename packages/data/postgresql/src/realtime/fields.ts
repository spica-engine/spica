import {parseRule} from "../access/rule/compiler.js";

type Node = any;

class Unknown extends Error {}

function pathOf(node: Node): {root: string; path: string[]} {
  const path: string[] = [];
  let current = node;
  while (current.kind == "operator" && current.type == "select") {
    if (current.right.kind != "identifier") {
      throw new Unknown();
    }
    path.unshift(current.right.name);
    current = current.left;
  }
  if (current.kind != "identifier") {
    throw new Unknown();
  }
  return {root: current.name, path};
}

function collect(node: Node, fields: Set<string>) {
  if (Array.isArray(node)) {
    node.forEach(item => collect(item, fields));
    return;
  }
  switch (node.kind) {
    case "literal":
      return;
    case "identifier":
    case "operator":
      if (node.kind == "identifier" || node.type == "select") {
        const {root, path} = pathOf(node);
        if (root == "auth") {
          return;
        }
        const [field] = root == "document" ? path : [root];
        if (!field) {
          throw new Unknown();
        }
        fields.add(field);
        return;
      }
      if (node.category == "tenary") {
        [node.test, node.consequent, node.alternative].forEach(part => collect(part, fields));
        return;
      }
      collect(node.left, fields);
      collect(node.right, fields);
      return;
    case "unary":
      collect(node.member, fields);
      return;
    case "call":
      collect(node.arguments, fields);
      return;
    default:
      throw new Unknown();
  }
}

export function fieldsOfExpression(expression: string): Set<string> | undefined {
  try {
    const fields = new Set<string>();
    collect(parseRule(expression), fields);
    return fields;
  } catch {
    return undefined;
  }
}
