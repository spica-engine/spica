import {Triggers, Function, Trigger} from "@spica-server/interface/function";
import * as ts from "typescript";

export interface FunctionDeclarationModifier {
  decorators: ts.Decorator[];
  setDecorators: () => void;

  modifiers: ts.Modifier[];
  setModifiers: () => void;

  asteriksToken: ts.AsteriskToken;
  setAsteriksToken: () => void;

  name: ts.Identifier;
  setName: () => void;

  typeParameters: ts.TypeParameterDeclaration[];
  setTypeParameters: () => void;

  parameters: ts.ParameterDeclaration[];
  setParameters: () => void;

  type: ts.TypeNode;
  setType: () => void;

  body: ts.Block;
  setBody: () => void;

  setAllDeclarationDependencies: () => void;

  getImportDeclarations: () => ts.ImportDeclaration[];

  modify: () => ts.FunctionDeclaration;
}

export abstract class HttpService implements FunctionDeclarationModifier {
  static _name: string;

  url: string;
  method: string;

  private _isHandlerDefault: boolean;
  public get isHandlerDefault(): boolean {
    return this.handler == "default";
  }

  modifiers: ts.Modifier[] = [];
  setModifiers() {
    const modifiers: ts.ModifierToken<ts.ModifierSyntaxKind>[] = [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)
    ];

    if (this.isHandlerDefault) {
      modifiers.push(ts.factory.createModifier(ts.SyntaxKind.DefaultKeyword));
    }

    this.modifiers = modifiers;
  }

  name: ts.Identifier;
  setName() {
    this.name = !this.isHandlerDefault ? ts.factory.createIdentifier(this.handler) : undefined;
  }

  body: ts.FunctionBody;
  setBody() {}

  parameters: ts.ParameterDeclaration[] = [];
  setParameters() {
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

  decorators: ts.Decorator[];
  setDecorators() {}

  asteriksToken: ts.AsteriskToken;
  setAsteriksToken() {}

  typeParameters: ts.TypeParameterDeclaration[];
  setTypeParameters() {}

  type: ts.TypeNode;
  setType() {}

  constructor(
    private node: ts.FunctionDeclaration,
    private baseUrl: string,
    private handler: string,
    private trigger: Trigger
  ) {
    this.url = `${this.baseUrl}/fn-execute${this.trigger.options.path}`;
    this.method = this.trigger.options.method;

    this.setAllDeclarationDependencies();
  }

  getImportDeclarations() {
    return [];
  }

  setAllDeclarationDependencies() {
    this.setModifiers();
    this.setName();
    this.setBody();
    this.setParameters();

    // unused for now
    this.setDecorators();
    this.setAsteriksToken();
    this.setTypeParameters();
    this.setType();
  }

  modify() {
    return ts.factory.updateFunctionDeclaration(
      this.node,
      this.decorators,
      this.modifiers,
      this.asteriksToken,
      this.name,
      this.typeParameters,
      this.parameters,
      this.type,
      this.body
    );
  }
}

export class Axios extends HttpService {
  static _name = "axios";

  static getImportDeclarations() {
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

  setBody(): void {
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

export type HttpServiceFactory = (node, baseUrl, handler, trigger) => HttpService;
export type HttpServiceFactoryMap = Map<string, HttpServiceFactory>;
export const defaulHttpServiceFactoryMap: HttpServiceFactoryMap = new Map();
defaulHttpServiceFactoryMap.set(
  Axios._name,
  (node, baseUrl, handler, trigger) => new Axios(node, baseUrl, handler, trigger)
);
// add new http services here, like got, node-fetch etc.

export type HttpServiceImportsMap = Map<string, () => ts.ImportDeclaration[]>;
export const defaultHttpServiceImportsMap: HttpServiceImportsMap = new Map();
defaultHttpServiceImportsMap.set(Axios._name, Axios.getImportDeclarations);
// import declarations does not need to be created on the visiting node phase.
// mark each HttpService import as static and add this map so HttpTransformer will be able to
// return import declarations before visit each node

export class HttpTransformer implements TriggerTransformer {
  static _name = "http";

  private _importDeclarations: ts.ImportDeclaration[];
  public get importDeclarations(): ts.ImportDeclaration[] {
    return this._importDeclarations;
  }
  public set importDeclarations(value: ts.ImportDeclaration[]) {
    this._importDeclarations = value;
  }

  httpServiceFactory: HttpServiceFactory;

  constructor(
    private triggers: Triggers,
    private baseUrl: string,
    private additionals: {selectedHttpService: string},
    private httpServiceFactoryMap: HttpServiceFactoryMap = defaulHttpServiceFactoryMap,
    private httpServiceImportsMap: HttpServiceImportsMap = defaultHttpServiceImportsMap
  ) {
    const factory = this.httpServiceFactoryMap.get(additionals.selectedHttpService);
    if (!factory) {
      throw new Error(
        `Http service named ${additionals.selectedHttpService} is not implemented yet`
      );
    }

    this.httpServiceFactory = factory;

    const getImports = this.httpServiceImportsMap.get(additionals.selectedHttpService);
    if (getImports) {
      this.importDeclarations = getImports();
    }
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
      if (!handler || !triggers[handler]) {
        return node;
      }

      const httpService = this.httpServiceFactory(node, this.baseUrl, handler, triggers[handler]);

      return httpService.modify();
    };

    return visitor;
  }
}

export type TriggerTransformerFactoryMap = Map<string, (...args) => TriggerTransformer>;
export const defaultTriggerTransformerFactories: TriggerTransformerFactoryMap = new Map();
defaultTriggerTransformerFactories.set(
  HttpTransformer._name,
  (triggers, baseUrl, options: {selectedHttpService}) =>
    new HttpTransformer(triggers, baseUrl, options)
);
// add new TriggerTransformers here

export interface TriggerTransformerAdditionalParams {
  http?: {
    selectedHttpService: string;
  };
}

export class FunctionCompiler {
  variables: string[] = [];
  sourceFile: ts.SourceFile;

  constructor(
    private fn: FunctionWithIndex,
    private triggerTypes: string[],
    private baseUrl: string,
    private triggerTransformerAdditionalParams: TriggerTransformerAdditionalParams,
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

      const transformer = factory(
        relevantTriggers,
        this.baseUrl,
        this.triggerTransformerAdditionalParams[triggerType]
      );
      imports.push(...transformer.importDeclarations);
      transformers.push(transformer.getTransformer());
    }

    this.sourceFile = ts.transform(this.sourceFile, transformers).transformed[0];

    // add imports at the end of transformation processes, otherwise they might be deleted
    this.sourceFile = ts.factory.updateSourceFile(this.sourceFile, [
      ...imports,
      ...this.sourceFile.statements
    ]);

    // return ts.createPrinter().printFile(this.sourceFile);
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
          return disableStatement(node);
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
  importDeclarations: ts.ImportDeclaration[];
  getTransformer: () => Transformer;
  getVisitor: (triggers: Triggers, context: ts.TransformationContext) => Visitor;
}

export function codeToAst(code: string) {
  return ts.createSourceFile("name.ts", code, ts.ScriptTarget.Latest);
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

// export function clearEmptyStatementTraces(code: string) {
//   return code.replace(/^;[\n|;]*$\n/gm, "");
// }

export function disableStatement(node: ts.Node) {
  node = ts.factory.createEmptyStatement();
  node = ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.SingleLineCommentTrivia,
    " This statement has been deleted."
  );
  return node;
}

export type FunctionWithIndex = Function & {index: string};
