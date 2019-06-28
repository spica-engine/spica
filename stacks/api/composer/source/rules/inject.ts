import * as ts from "typescript";
import {SourceContext} from "../interface";
import {findFirst} from "./helper";

/**
 * Add an injection call to to factory function
 */
export function addInject<T>(
  context: SourceContext,
  importSpecifier: string,
  moduleSpecifier: string
): ts.TransformerFactory<ts.SourceFile> {
  const coreIdentifier = context.import.ensure("@angular/core");
  const namespaceIdentifier = context.import.ensure(moduleSpecifier);
  return context => {
    const visit: ts.Visitor = node => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text == "ɵdefineComponent"
      ) {
        const [arg] = node.arguments;
        if (ts.isObjectLiteralExpression(arg)) {
          const constsProperty = arg.properties.find(
            prop => prop.name.getText() == "factory"
          ) as ts.PropertyAssignment;

          const newExpr = findFirst(constsProperty.initializer, ts.isNewExpression);

          newExpr.arguments = ts.createNodeArray([
            ...newExpr.arguments,
            ts.createCall(
              ts.createPropertyAccess(coreIdentifier, ts.createIdentifier("ɵdirectiveInject")),
              undefined,
              ts.createNodeArray([ts.createPropertyAccess(namespaceIdentifier, importSpecifier)])
            )
          ]);
        }

        return node;
      }

      return ts.visitEachChild(node, visit, context);
    };

    return node => ts.visitNode(node, visit);
  };
}

/**
 * Add an parameter to constructor
 */
export function addConstructorParameter(
  context: SourceContext,
  importSpecifier: string,
  moduleSpecifier: string
): {identifier: ts.Identifier; transform: ts.TransformerFactory<ts.SourceFile>} {
  const propertyIdentifier = ts.createUniqueName("param");
  const namespace = context.import.ensure(moduleSpecifier);
  return {
    transform: context => {
      const visit: ts.Visitor = node => {
        if (ts.isConstructorDeclaration(node)) {
          node.parameters = ts.createNodeArray([
            ...node.parameters,
            ts.createParameter(
              undefined,
              ts.createNodeArray([ts.createModifier(ts.SyntaxKind.PublicKeyword)]),
              undefined,
              propertyIdentifier,
              undefined,
              ts.createTypeReferenceNode(
                ts.createQualifiedName(namespace, ts.createIdentifier(importSpecifier)),
                undefined
              )
            )
          ]);
          return node;
        }

        return ts.visitEachChild(node, visit, context);
      };

      return node => ts.visitNode(node, visit);
    },
    identifier: propertyIdentifier
  };
}
