import * as ts from "typescript";

export class AssertError extends Error {}

export function assertKind(node: ts.Node, ...kinds: ts.SyntaxKind[]) {
  if (kinds.indexOf(node.kind) == -1) {
    throw new AssertError(
      `Node must be one of ${kinds.map(k => ts.SyntaxKind[k]).join()}. Got ${
        ts.SyntaxKind[node.kind]
      }`
    );
  }
}

export function assertIs(node: ts.Node, test: () => boolean) {
  if (!test()) {
    throw new AssertError(`Assert failed. Got ${ts.SyntaxKind[node.kind]}`);
  }
}
