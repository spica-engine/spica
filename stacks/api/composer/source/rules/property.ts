import * as ts from "typescript";

export function addProperty(modifiers: ReadonlyArray<ts.Modifier>, initializer: ts.Expression) {
  const identifier = ts.createUniqueName("property");
  return {
    identifier,
    transform: context => {
      const visitor: ts.Visitor = (node: ts.ClassDeclaration) => {
        if (ts.isClassDeclaration(node)) {
          const property = ts.createProperty(
            undefined,
            modifiers || [ts.createModifier(ts.SyntaxKind.PublicKeyword)],
            identifier,
            undefined,
            undefined,
            initializer
          );
          return ts.updateClassDeclaration(
            node,
            node.decorators,
            node.modifiers,
            node.name,
            node.typeParameters,
            node.heritageClauses,
            [...node.members, property]
          );
        }

        return ts.visitEachChild(node, visitor, context);
      };

      return node => ts.visitNode(node, visitor);
    }
  };
}
