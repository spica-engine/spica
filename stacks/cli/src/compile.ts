import {Triggers, Function, Trigger} from "@spica-server/interface/function";
import * as ts from "typescript";

export class HttpTransformer implements TriggerTransformer {
  static _name = "http";
  constructor(private triggers: Triggers, private baseUrl: string) {}

  getImportDeclarations(): ts.ImportDeclaration[] {
    const src = codeToAst("import axios from 'axios';");
    return [src.statements[0]] as ts.ImportDeclaration[];
  }

  getTransformer() {
    const transformer: Transformer = context => rootNode => {
      const visitor = this.getVisitor(this.triggers, context);
      return ts.visitNode(rootNode, visitor);
    };
    return transformer;
  }

  getVisitor(triggers: Triggers, context: ts.TransformationContext) {
    const visitor: Visitor = node => {
      if (ts.isSourceFile(node)) {
        return ts.visitEachChild(node, visitor, context);
      }

      const handler = ts.isFunctionDeclaration(node) ? getFunctionName(node) : undefined;
      if(!handler){
        return node;
      }

      const trigger = triggers[handler];

      // if node is one of trigger handler, modify and return it
      const url = `${this.baseUrl}/fn-execute${trigger.options.path}`;
      const method = (trigger.options.method as string).toLowerCase();
      const isDefault = handler == "default";

      // @TODO: writing code in this way is so unreadable and unmaintable.
      // I tried to create my code in string, give that string to the ts.sourcefile and return the node
      // for example: ts.createSourceFile("foo.ts","export function bar(param1,param2){ return console.log('OK'); }").statements[0]
      // but it cause to see some other issues, like some wrong placement of comment lines, probably because of the start,end position of nodes on that code.
      // put a better implementation here.

      const fnParams = [
        createParam("params", ts.SyntaxKind.AnyKeyword),
        createParam("data", ts.SyntaxKind.AnyKeyword)
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
              ts.factory.createStringLiteral(method)
            ),
            ts.factory.createPropertyAssignment(
              ts.factory.createIdentifier("url"),
              ts.factory.createStringLiteral(url)
            )
          ],
          false
        )
      ];

      const requestCall = ts.factory.createCallExpression(requestAccess, undefined, requestArgs);

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

      const thenCall = ts.factory.createCallExpression(thenAccess, undefined, [thenArgs]);

      const returnStatement = ts.factory.createReturnStatement(thenCall);

      const fnBody = ts.factory.createBlock([returnStatement], true);

      const modifiers: ts.ModifierToken<ts.ModifierSyntaxKind>[] = [
        ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)
      ];
      let name = ts.factory.createIdentifier(handler);
      if (isDefault) {
        modifiers.push(ts.factory.createModifier(ts.SyntaxKind.DefaultKeyword));
        name = undefined;
      }

      return ts.factory.updateFunctionDeclaration(
        node as ts.FunctionDeclaration,
        undefined,
        modifiers,
        undefined,
        name,
        undefined,
        fnParams,
        undefined,
        fnBody
      );
    };

    return visitor;
  }
}

export type TriggerTransformerFactoryMap = Map<string, (...args) => TriggerTransformer>;
export const defaultTriggerTransformerFactories: TriggerTransformerFactoryMap = new Map();
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
    private triggerTransformerFactories: TriggerTransformerFactoryMap = defaultTriggerTransformerFactories
  ) {
    this.fn.triggers = this.filterTriggers(this.fn.triggers, ([_, trigger]) =>
      this.triggerTypes.includes(trigger.type)
    );
    this.sourceFile = ts.createSourceFile(fn.name, fn.index, ts.ScriptTarget.Latest);
  }

  compile() {
    const transformers = [];
    const imports: ts.ImportDeclaration[] = [];

    // eliminate unnecessary statements
    const handlerNames = this.getHandlerNames();
    const handlerFiltererTransormer = this.getHandlerFiltererTransformer(handlerNames);
    transformers.push(handlerFiltererTransormer);

    // update triggers
    for (const triggerType of this.triggerTypes) {
      const factory = this.triggerTransformerFactories.get(triggerType);
      if (!factory) {
        throw Error(`Trigger type ${triggerType} does not have any transformer.`);
      }

      const relevantTriggers = this.filterTriggers(
        this.fn.triggers,
        ([_, trigger]) => trigger.type == triggerType
      );

      if (!Object.keys(relevantTriggers).length) {
        continue;
      }

      const transformer = factory(relevantTriggers, this.baseUrl);
      imports.push(...transformer.getImportDeclarations());
      transformers.push(transformer.getTransformer());
    }

    this.sourceFile = ts.transform(this.sourceFile, transformers).transformed[0];

    // add imports at the end of transformation processes, otherwise they might be deleted
    this.sourceFile = ts.factory.updateSourceFile(this.sourceFile, [
      ...imports,
      ...this.sourceFile.statements
    ]);

    return ts.createPrinter().printFile(this.sourceFile);
  }

  getHandlerNames() {
    return Object.keys(this.fn.triggers);
  }

  filterTriggers(
    triggers: Triggers,
    filter: ([handler, trigger]: [string, Trigger]) => boolean
  ): Triggers {
    return Object.entries(triggers)
      .filter(filter)
      .reduce((acc, [handler, trigger]) => {
        acc[handler] = trigger;
        return acc;
      }, {});
  }

  getHandlerFiltererTransformer(handlerNames: string[]) {
    const transformer: Transformer = context => rootNode => {
      const visitor = (node: ts.Node): ts.Node => {
        const isRootNode = node.kind == ts.SyntaxKind.SourceFile;

        if (isRootNode) {
          return ts.visitEachChild(node, visitor, context);
        }

        // returning undefined for any statement is not allowed, returning empty statement is an option, but it will leave `;` line behind.
        // there should be a better option
        const isNecessaryStatement = ts.isFunctionDeclaration(node)
          ? handlerNames.includes(getFunctionName(node))
          : false;

        if (!isNecessaryStatement) {
          return ts.factory.createEmptyStatement();
        }

        // we don't need to visit child node of these handlers
        return node;
      };

      return ts.visitNode(rootNode, visitor);
    };

    return transformer;
  }
}

export type Transformer = (context: ts.TransformationContext) => (rootNode: ts.Node) => ts.Node;
export type Visitor = (node: ts.Node) => ts.Node;

export class TriggerTransformer {
  static _name: string;
  getImportDeclarations: () => ts.ImportDeclaration[];
  getTransformer: () => Transformer;
  getVisitor: (triggers: Triggers, context: ts.TransformationContext) => Visitor;
}

export function codeToAst(code: string) {
  return ts.createSourceFile("name.ts", code, ts.ScriptTarget.Latest);
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

export type FunctionWithIndex = Function & {index: string};
