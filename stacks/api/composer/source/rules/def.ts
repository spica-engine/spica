import * as ts from "typescript";
import {SourceContext} from "../interface";

/**
 * Add a new directive to componentDef's directives
 */
export function addToComponentDef(
  ctx: SourceContext,
  propertyName: string,
  importSpecifier: string,
  moduleSpecifier: string
): ts.TransformerFactory<ts.SourceFile> {
  const module = ctx.import.ensure(moduleSpecifier);
  return context => {
    const visit: ts.Visitor = node => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text == "ɵdefineComponent"
      ) {
        const arg = node.arguments[0] as ts.ObjectLiteralExpression;

        const directivesProperty = arg.properties.find(
          prop => (prop.name as ts.Identifier).text == propertyName
        ) as ts.PropertyAssignment;
        const initializer = directivesProperty.initializer as ts.ArrayLiteralExpression;
        const hasIdentifier = initializer.elements.find(e => {
          const identifier = ts.isPropertyAccessExpression(e) ? e.name : e;
          return ts.isIdentifier(identifier) && identifier.text == importSpecifier;
        });
        if (!hasIdentifier) {
          directivesProperty.initializer = ts.createArrayLiteral([
            ...initializer.elements,
            ts.createPropertyAccess(module, ts.createIdentifier(importSpecifier))
          ]);
        }

        return node;
      }

      return ts.visitEachChild(node, visit, context);
    };

    return node => ts.visitNode(node, visit);
  };
}

export function addDirective(ctx: SourceContext, importSpecifier: string, moduleSpecifier: string) {
  return addToComponentDef(ctx, "directives", importSpecifier, moduleSpecifier);
}

export function addPipe<T>(ctx: SourceContext, importSpecifier: string, moduleSpecifier: string) {
  return addToComponentDef(ctx, "pipes", importSpecifier, moduleSpecifier);
}
