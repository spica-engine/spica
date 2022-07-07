import { Triggers, Function } from "@spica-server/interface/function";
import * as ts from "typescript";

export class HttpTransformer implements Transformer {
  static _name = "http";
  constructor(private triggers: Triggers, private baseUrl: string) {}

  getImportDeclarations(): ts.ImportDeclaration[] {
    const namespaceImport = ts.factory.createNamespaceImport(
      ts.factory.createIdentifier("axios")
    );
    const importClause = ts.factory.createImportClause(
      undefined,
      undefined,
      namespaceImport
    );

    return [
      ts.factory.createImportDeclaration(
        undefined,
        undefined,
        importClause,
        ts.factory.createStringLiteral("axios")
      ),
    ];
  }

  getTransformer() {
    const transformer =
      <T extends ts.Node>(context: ts.TransformationContext) =>
      (rootNode: T) => {
        const visitor = this.getVisitor(this.triggers, context);
        return ts.visitNode(rootNode, visitor);
      };
    return transformer;
  }

  getVisitor(triggers: Triggers, context: ts.TransformationContext) {
    const visitor = (node: ts.Node): ts.Node => {
      // if node is one of trigger handler, modify and return it
      const trigger =
        triggers[(node as ts.FunctionDeclaration).name?.escapedText as string];
      if (ts.isFunctionDeclaration(node) && trigger) {
        const fnParams = [
          createParam("params", ts.SyntaxKind.AnyKeyword),
          createParam("data", ts.SyntaxKind.AnyKeyword),
        ];

        const requestAccess = ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier("axios"),
          ts.factory.createIdentifier("request")
        );

        const requestArgs = [
          ts.factory.createObjectLiteralExpression(
            [
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier("params"),
                ts.factory.createIdentifier("params")
              ),
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier("data"),
                ts.factory.createIdentifier("data")
              ),
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier("method"),
                ts.factory.createStringLiteral(trigger.options.method)
              ),
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier("url"),
                ts.factory.createStringLiteral(
                  `${this.baseUrl}/fn-execute${trigger.options.path}`
                )
              ),
            ],
            false
          ),
        ];

        const requestCall = ts.factory.createCallExpression(
          requestAccess,
          undefined,
          requestArgs
        );

        const thenParams = [createParam("r", ts.SyntaxKind.AnyKeyword)];

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

        const thenCall = ts.factory.createCallExpression(
          thenAccess,
          undefined,
          [thenArgs]
        );

        const returnStatement = ts.factory.createReturnStatement(thenCall);

        const fnBody = ts.factory.createBlock([returnStatement], true);

        return ts.factory.updateFunctionDeclaration(
          node,
          undefined,
          [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          undefined,
          node.name,
          undefined,
          fnParams,
          undefined,
          fnBody
        );
      }

      // for all the other kind of nodes, we just return the node (no transformation or replacement)
      return ts.visitEachChild(node, visitor, context);
    };

    return visitor;
  }
}

export const defaultTriggerTransformerFactories: Map<
  string,
  (...args) => Transformer
> = new Map();
defaultTriggerTransformerFactories.set(
  HttpTransformer._name,
  (triggers, baseUrl) => new HttpTransformer(triggers, baseUrl)
);
// add new TriggerTransformers here

export class FunctionCompiler {
  variables: string[] = [];
  sourceFile: ts.SourceFile;

  constructor(
    private fn: FunctionWithIndex,
    private triggerTypes: string[],
    private baseUrl: string,
    private triggerTransformerFactories: Map<
      string,
      (...args) => Transformer
    > = defaultTriggerTransformerFactories
  ) {
    this.filterNecessaryTriggers();
    this.sourceFile = ts.createSourceFile(
      fn.name,
      fn.index,
      ts.ScriptTarget.Latest
    );
  }

  compile() {
    const transformers = [];
    const imports: ts.ImportDeclaration[] = [];
    // eliminate unnecessary statements
    const handlerNames = this.getHandlerNames();
    const baseFilterTransformer = this.getCodeHandlerFilterer(handlerNames);
    transformers.push(baseFilterTransformer);

    // get transformer for each trigger type
    for (const [handler, trigger] of Object.entries(this.fn.triggers)) {
      const factory = this.triggerTransformerFactories.get(trigger.type);
      if (!factory) {
        throw Error(
          `Trigger type ${trigger.type} does not have any transformer.`
        );
      }

      const transformer = factory({ [handler]: trigger }, this.baseUrl);
      imports.push(...transformer.getImportDeclarations());
      transformers.push(transformer.getTransformer())
    }

    this.sourceFile = ts.transform(
      this.sourceFile,
      transformers
    ).transformed[0];

    // add imports at the end of transformation processes
    this.sourceFile = ts.factory.updateSourceFile(this.sourceFile, [
      ...imports,
      ...this.sourceFile.statements,
    ]);

    return ts.createPrinter().printFile(this.sourceFile);
  }

  getHandlerNames() {
    return Object.keys(this.fn.triggers);
  }

  filterNecessaryTriggers() {
    this.fn.triggers = Object.entries(this.fn.triggers)
      .filter(([_, trigger]) => this.triggerTypes.includes(trigger.type))
      .reduce((acc, [handler, trigger]) => {
        acc[handler] = trigger;
        return acc;
      }, {});
  }

  getCodeHandlerFilterer(handlerNames: string[]) {
    const transformer =
      <T extends ts.Node>(context: ts.TransformationContext) =>
      (rootNode: T) => {
        const visitor = (node: ts.Node): ts.Node => {
          const isRootNode = node.kind == ts.SyntaxKind.SourceFile;

          const isNecessaryHandler =
            ts.isFunctionDeclaration(node) &&
            handlerNames.includes(node.name?.escapedText as string);

          if (isRootNode) {
            return ts.visitEachChild(node, visitor, context);
          }

          // we don't need to visit child node of these handlers
          if (isNecessaryHandler) {
            return node;
          }

          // returning undefined for any statement is not allowed, returning empty statement is an option, but it will leave `;` line behind.
          // there should be a better option
          return ts.factory.createEmptyStatement();
        };

        return ts.visitNode(rootNode, visitor);
      };

    return transformer;
  }
}

export class Transformer {
  static _name: string;
  getImportDeclarations: () => ts.ImportDeclaration[];
  getTransformer: () => (
    context: ts.TransformationContext
  ) => (rootNode: ts.Node) => ts.Node;
  getVisitor: (
    triggers: Triggers,
    context: ts.TransformationContext
  ) => (node: ts.Node) => ts.Node;
}

export function createParam(name: string, type: ts.KeywordTypeSyntaxKind) {
  return ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    undefined,
    ts.factory.createIdentifier(name),
    undefined,
    ts.factory.createKeywordTypeNode(type),
    undefined
  );
}

export type FunctionWithIndex = Function & { index: string };
