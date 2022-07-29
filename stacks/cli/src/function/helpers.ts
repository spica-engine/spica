import * as ts from "typescript";

export function getFunctionName(node: ts.FunctionDeclaration) {
  if (node.name) {
    return node.name.escapedText as string;
  }

  const isDefault = node.modifiers.findIndex(m => m.kind == ts.SyntaxKind.DefaultKeyword) != -1;
  if (isDefault) {
    return "default";
  }

  return undefined;
}
