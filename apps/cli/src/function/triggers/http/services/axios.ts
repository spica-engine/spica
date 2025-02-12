import {Trigger} from "@spica-server/interface/function";
import ts from "typescript";
import {FunctionDeclarationModifier, SpicaFunctionModifier} from "../../../modifier";

export class Axios extends SpicaFunctionModifier {
  static modifierName = "axios";

  url: string;
  method: string;

  extraFunctionDeclarations: ts.FunctionDeclaration[] = [];
  registeredValidators: FunctionDeclarationModifier[] = [];

  constructor(
    node: ts.FunctionDeclaration,
    handler: string,
    baseUrl: string,
    trigger: Trigger,
    private validators = axiosValidators
  ) {
    super(node, handler);

    this.url = `${baseUrl}/fn-execute${trigger.options.path}`;
    this.method = trigger.options.method;

    for (const factory of this.validators) {
      const emptyFn = ts.factory.createFunctionDeclaration(
        [],
        undefined,
        undefined,
        [],
        [],
        undefined,
        undefined
      );
      const validator = factory(emptyFn);
      this.registeredValidators.push(validator);
      this.extraFunctionDeclarations.push(validator.modify() as ts.FunctionDeclaration);
    }
  }

  getExtraFunctionDeclarations(): ts.FunctionDeclaration[] {
    return this.extraFunctionDeclarations;
  }

  getImports() {
    const importClause = ts.factory.createImportClause(
      false,
      ts.factory.createIdentifier("axios"),
      undefined
    );
    const importDeclaration = ts.factory.createImportDeclaration(
      undefined,
      importClause,
      ts.factory.createStringLiteral("axios")
    );
    return [importDeclaration];
  }

  setParameters() {
    return [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        ts.factory.createIdentifier("config"),
        undefined,
        undefined,
        undefined
      )
    ];
  }

  setBody() {
    const configValue = ts.factory.createObjectLiteralExpression([
      ts.factory.createSpreadAssignment(ts.factory.createIdentifier("config")),
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier("method"),
        ts.factory.createStringLiteral(this.method.toLowerCase())
      ),
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier("url"),
        ts.factory.createStringLiteral(this.url)
      )
    ]);

    const configAssigment = ts.factory.createBinaryExpression(
      ts.factory.createIdentifier("config"),
      ts.SyntaxKind.FirstAssignment,
      configValue
    );

    const configStatement = ts.factory.createExpressionStatement(configAssigment);

    const validatorCalls: ts.Statement[] = [];
    for (const validator of this.registeredValidators) {
      const call = ts.factory.createCallExpression(validator.name, undefined, [
        ts.factory.createIdentifier("config")
      ]);
      validatorCalls.push(ts.factory.createExpressionStatement(call));
    }

    const requestAccess = ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("axios"),
      ts.factory.createIdentifier("request")
    );

    const requestArgs = [ts.factory.createIdentifier("config")];

    const requestCall = ts.factory.createCallExpression(requestAccess, undefined, requestArgs);

    const thenParams = [
      ts.factory.createParameterDeclaration(
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

    return ts.factory.createBlock([configStatement, ...validatorCalls, returnStatement], true);
  }
}

export class AxiosWriteValidator extends FunctionDeclarationModifier {
  static modifierName = "axiosWriteValidator";

  setAsteriksToken(): ts.AsteriskToken {
    return undefined;
  }

  setTypeParameters(): ts.TypeParameterDeclaration[] {
    return [];
  }

  setModifiers() {
    return [];
  }

  setType(): ts.TypeNode {
    return undefined;
  }

  setDecorators() {
    return [];
  }

  getImports() {
    return [];
  }

  getExtraFunctionDeclarations(): ts.FunctionDeclaration[] {
    return [];
  }

  setName(): ts.Identifier {
    return ts.factory.createIdentifier(AxiosWriteValidator.modifierName);
  }

  setParameters() {
    return [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        ts.factory.createIdentifier("config")
      )
    ];
  }

  setBody() {
    const writeMethods = ["post", "put", "patch"];
    const writeMethodsArray = ts.factory.createArrayLiteralExpression(
      writeMethods.map(m => ts.factory.createStringLiteral(m)),
      false
    );

    const includes = ts.factory.createPropertyAccessExpression(
      writeMethodsArray,
      ts.factory.createIdentifier("includes")
    );

    const configMethodAccess = ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("config"),
      ts.factory.createIdentifier("method")
    );

    const includesCall = ts.factory.createCallExpression(includes, undefined, [configMethodAccess]);

    const configData = ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("config"),
      ts.factory.createIdentifier("data")
    );

    const binaryExpression = ts.factory.createLogicalAnd(
      includesCall,
      ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, configData)
    );

    const warningMessage = `Sending empty request body for ${writeMethods.join(
      ", "
    )} requests is unusual. If it's not intented, please use config.data or update your spica function.`;

    const consoleWarnAccess = ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("console"),
      ts.factory.createIdentifier("warn")
    );

    const consoleWarnCall = ts.factory.createCallExpression(
      consoleWarnAccess,
      [],
      [ts.factory.createStringLiteral(warningMessage)]
    );

    const ifStatementBody = ts.factory.createBlock(
      [ts.factory.createExpressionStatement(consoleWarnCall)],
      true
    );

    const IfStatement = ts.factory.createIfStatement(binaryExpression, ifStatementBody);

    return ts.factory.createBlock([IfStatement], true);
  }
}

export class AxiosReadValidator extends FunctionDeclarationModifier {
  static modifierName = "axiosReadValidator";

  setAsteriksToken(): ts.AsteriskToken {
    return undefined;
  }

  setTypeParameters(): ts.TypeParameterDeclaration[] {
    return [];
  }

  setModifiers() {
    return [];
  }

  setType(): ts.TypeNode {
    return undefined;
  }

  setDecorators() {
    return [];
  }

  getImports() {
    return [];
  }

  getExtraFunctionDeclarations(): ts.FunctionDeclaration[] {
    return [];
  }

  setName(): ts.Identifier {
    return ts.factory.createIdentifier(AxiosReadValidator.modifierName);
  }

  setParameters() {
    return [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        ts.factory.createIdentifier("config")
      )
    ];
  }

  setBody() {
    const readMethods = ["get", "delete", "trace", "options", "head"];
    const readMethodsArray = ts.factory.createArrayLiteralExpression(
      readMethods.map(m => ts.factory.createStringLiteral(m)),
      false
    );

    const includes = ts.factory.createPropertyAccessExpression(
      readMethodsArray,
      ts.factory.createIdentifier("includes")
    );

    const configMethodAccess = ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("config"),
      ts.factory.createIdentifier("method")
    );

    const includesCall = ts.factory.createCallExpression(includes, undefined, [configMethodAccess]);

    const configData = ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("config"),
      ts.factory.createIdentifier("data")
    );

    const binaryExpression = ts.factory.createLogicalAnd(includesCall, configData);

    const warningMessage = `Sending request body for ${readMethods.join(
      ", "
    )} requests is unusual. If it's not intented, please remove config.data or update your spica function.`;

    const consoleWarnAccess = ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("console"),
      ts.factory.createIdentifier("warn")
    );

    const consoleWarnCall = ts.factory.createCallExpression(
      consoleWarnAccess,
      [],
      [ts.factory.createStringLiteral(warningMessage)]
    );

    const ifStatementBody = ts.factory.createBlock(
      [ts.factory.createExpressionStatement(consoleWarnCall)],
      true
    );

    const IfStatement = ts.factory.createIfStatement(binaryExpression, ifStatementBody);

    return ts.factory.createBlock([IfStatement], true);
  }
}

const axiosValidators = [
  node => new AxiosWriteValidator(node),
  node => new AxiosReadValidator(node)
];

export const axios = {
  name: Axios.modifierName,
  factory: (node, handler, baseUrl, trigger) => new Axios(node, handler, baseUrl, trigger)
};
