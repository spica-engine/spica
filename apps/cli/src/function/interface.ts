import {Triggers, Function, Trigger} from "../../../../libs/interface/function";
import ts from "typescript";
import {FunctionDeclarationModifier} from "./modifier";

export abstract class TriggerTransformer<T extends ts.Node> {
  static _name: string;
  abstract getTransformer: () => ts.TransformerFactory<T>;
  abstract getVisitor: (triggers: Triggers, context: ts.TransformationContext) => ts.Visitor;
}

export type FunctionWithIndex = Function & {index: string};

export type FunctionModifier = (
  node: ts.FunctionDeclaration,
  handler: string,
  baseUrl: string,
  trigger: Trigger
) => FunctionDeclarationModifier;
export type FunctionModifiers = Map<string, FunctionModifier>;

export type TriggerTransformers<T extends ts.Node> = Map<
  string,
  (triggers: Triggers, baseUrl: string, options: TriggerTransformerOptions) => TriggerTransformer<T>
>;

export interface TriggerOptions {
  http?: HttpOptions;
}

export interface HttpOptions {
  selectedService: string;
}

export interface CommonTriggerTransformerOptions {
  addImports: (imports: ts.ImportDeclaration[]) => void;
  addExtraFunctions: (fns: ts.FunctionDeclaration[]) => void;
}

export type TriggerTransformerOptions = {[key: string]: any} & CommonTriggerTransformerOptions;

export type HttpTriggerTransformerOptions = HttpOptions & CommonTriggerTransformerOptions;
