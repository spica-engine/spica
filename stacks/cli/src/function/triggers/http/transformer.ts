import {Triggers} from "@spica-server/interface/function";
import * as ts from "typescript";
import {getFunctionName} from "../../helpers";
import {
  TriggerTransformer,
  FunctionModifier,
  HttpTriggerTransformerOptions,
  FunctionModifiers
} from "../../interface";
import {httpServiceModifiers} from "./services";

export class HttpTransformer implements TriggerTransformer<ts.Node> {
  static _name = "http";

  modifier: FunctionModifier;

  constructor(
    private triggers: Triggers,
    private baseUrl: string,
    private options: Required<HttpTriggerTransformerOptions>,
    private modifiers: FunctionModifiers = httpServiceModifiers
  ) {
    const factory = this.modifiers.get(options.selectedService);
    if (!factory) {
      throw new Error(`Http service named ${options.selectedService} is not implemented yet`);
    }

    this.modifier = factory;
  }

  getTransformer() {
    const transformer: ts.TransformerFactory<ts.Node> = context => rootNode => {
      const visitor = this.getVisitor(this.triggers, context);
      return ts.visitNode(rootNode, visitor);
    };
    return transformer;
  }

  getVisitor(triggers: Triggers, context: ts.TransformationContext) {
    const visitor: ts.Visitor = node => {
      if (ts.isSourceFile(node)) {
        return ts.visitEachChild(node, visitor, context);
      }

      const handler = ts.isFunctionDeclaration(node) ? getFunctionName(node) : undefined;
      if (!handler || !triggers[handler]) {
        return node;
      }

      const modifier = this.modifier(
        node as ts.FunctionDeclaration,
        this.baseUrl,
        handler,
        triggers[handler]
      );

      this.options.addImports(modifier.getImports());

      return modifier.modify();
    };

    return visitor;
  }
}
