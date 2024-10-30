import {Triggers, Function, Trigger} from "@interface/function";
import * as ts from "typescript";
import {getFunctionName} from "./function/helpers";
import {FunctionWithIndex, TriggerOptions} from "./function/interface";
import {triggerTransformers} from "./function/triggers";

export class FunctionCompiler {
  sourceFile: ts.SourceFile;

  constructor(
    private fn: FunctionWithIndex,
    private triggerTypes: string[],
    private baseUrl: string,
    private triggerOptions: TriggerOptions,
    private transformers = triggerTransformers
  ) {
    this.fn.triggers = this.filterTriggers(this.fn.triggers, ([_, trigger]) =>
      this.triggerTypes.includes(trigger.type)
    );
    this.sourceFile = ts.createSourceFile(fn.name, fn.index, ts.ScriptTarget.Latest);
  }

  compile() {
    const transformers = [];
    const imports: ts.ImportDeclaration[] = [];
    const extraFunctions: ts.FunctionDeclaration[] = [];

    const addImports = (_imports: ts.ImportDeclaration[]) => imports.push(..._imports);
    const addExtraFunctions = (fns: ts.FunctionDeclaration[]) => extraFunctions.push(...fns);

    // eliminate unnecessary statements
    const handlerNames = this.getHandlerNames();
    const handlerFilterer = this.getHandlerFiltererTransformer(handlerNames);
    transformers.push(handlerFilterer);

    // update triggers
    for (const triggerType of this.triggerTypes) {
      const factory = this.transformers.get(triggerType);
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

      const transformerOptions = {
        ...this.triggerOptions[triggerType],
        addImports,
        addExtraFunctions
      };

      const transformer = factory(relevantTriggers, this.baseUrl, transformerOptions);
      transformers.push(transformer.getTransformer());
    }

    this.sourceFile = ts.transform(this.sourceFile, transformers).transformed[0];

    // add imports at the end of transformation processes, otherwise they might be deleted
    this.sourceFile = ts.factory.updateSourceFile(this.sourceFile, [
      ...imports,
      ...this.sourceFile.statements,
      ...extraFunctions
    ]);

    const code = ts.createPrinter().printFile(this.sourceFile);

    switch (this.fn.language) {
      case "typescript":
        return [{extension: "ts", content: code}];
      case "javascript":
        const types = this.generateTypesOfCode(code);
        return [{extension: "js", content: code}, {extension: "d.ts", content: types}];
      default:
        throw Error(`Language named ${this.fn.language} has no compiler yet.`);
    }
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
    const transformer = context => rootNode => {
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
          return this.disableStatement(node);
        }

        // we don't need to visit child node of these handlers
        return node;
      };

      return ts.visitNode(rootNode, visitor);
    };

    return transformer;
  }

  codeToAst(code: string) {
    return ts.createSourceFile("name.ts", code, ts.ScriptTarget.Latest);
  }

  // export function clearEmptyStatementTraces(code: string) {
  //   return code.replace(/^;[\n|;]*$\n/gm, "");
  // }

  disableStatement(node: ts.Node) {
    node = ts.factory.createEmptyStatement();
    node = ts.addSyntheticLeadingComment(
      node,
      ts.SyntaxKind.SingleLineCommentTrivia,
      " This statement has been deleted."
    );
    return node;
  }

  generateTypesOfCode(code: string) {
    let types: string;

    const options: ts.CompilerOptions = {
      allowJs: true,
      declaration: true,
      emitDeclarationOnly: true
    };
    const host = ts.createCompilerHost(options);

    host.writeFile = (_, data) => {
      types = data;
    };
    host.readFile = () => code;

    const program = ts.createProgram(["dummy.js"], options, host);
    program.emit();

    return types;
  }
}
