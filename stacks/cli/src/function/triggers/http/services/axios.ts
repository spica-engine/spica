import {Trigger} from "@spica-server/interface/function";
import * as ts from "typescript";
import {FunctionDeclarationModifier} from "../../../modifier";

export class Axios extends FunctionDeclarationModifier {
  static modifierName = "axios";

  url: string;
  method: string;

  constructor(node: ts.FunctionDeclaration, handler: string, baseUrl: string, trigger: Trigger) {
    super(node, handler);

    this.url = `${baseUrl}/fn-execute${trigger.options.path}`;
    this.method = trigger.options.method;
  }

  getImports() {
    const importClause = ts.factory.createImportClause(
      false,
      ts.factory.createIdentifier("axios"),
      undefined
    );
    const importDeclaration = ts.factory.createImportDeclaration(
      undefined,
      undefined,
      importClause,
      ts.factory.createStringLiteral("axios")
    );
    return [importDeclaration];
  }

  setParameters(): void {
    this.parameters = [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        undefined,
        ts.factory.createIdentifier("config"),
        undefined,
        undefined,
        undefined
      )
    ];
  }

  setDecorators(): void {}

  setBody(): void {
    const requestAccess = ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("axios"),
      ts.factory.createIdentifier("request")
    );

    const requestArgs = [
      ts.factory.createObjectLiteralExpression([
        ts.factory.createSpreadAssignment(ts.factory.createIdentifier("config")),
        ts.factory.createPropertyAssignment(
          ts.factory.createIdentifier("method"),
          ts.factory.createStringLiteral(this.method.toLowerCase())
        ),
        ts.factory.createPropertyAssignment(
          ts.factory.createIdentifier("url"),
          ts.factory.createStringLiteral(this.url)
        )
      ])
    ];

    const requestCall = ts.factory.createCallExpression(requestAccess, undefined, requestArgs);

    const thenParams = [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        undefined,
        ts.factory.createIdentifier("r"),
        undefined,
        undefined,
        undefined
      )
    ];

    const thenBody = ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("r"),
      ts.factory.createIdentifier("data")
    );

    const thenArgs = ts.factory.createArrowFunction(
      undefined,
      undefined,
      thenParams,
      undefined,
      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      thenBody
    );

    const thenAccess = ts.factory.createPropertyAccessExpression(
      requestCall,
      ts.factory.createIdentifier("then")
    );

    const thenCall = ts.factory.createCallExpression(thenAccess, undefined, [thenArgs]);

    const returnStatement = ts.factory.createReturnStatement(thenCall);

    this.body = ts.factory.createBlock([returnStatement], true);
  }
}

export const axios = {
  name: Axios.modifierName,
  factory: (node, handler, baseUrl, trigger) => new Axios(node, handler, baseUrl, trigger)
};
