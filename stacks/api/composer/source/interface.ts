import {virtualFs} from "@angular-devkit/core";
import * as ts from "typescript";
import {SourceEngine} from "./engine";

export interface SourceContext {
  host: virtualFs.Host;
  engine: SourceEngine;
  root: string;
  program?: ts.Program;
  source?: ts.SourceFile;
  transforms: Array<ts.TransformerFactory<ts.SourceFile>>;
  analysis?: any;
  import?: {
    has: (moduleSpecifier: string) => ts.Identifier | undefined;
    add: (moduleSpecifier: string) => ts.Identifier;
    ensure: (moduleSpecifier: string) => ts.Identifier;
    remove: (moduleSpecifier: string) => void;
    getModule: (namespaceIdentifier: string) => string;
  };
}

export type Source<T = ts.Node> = (context: SourceContext) => T;
export type Rule<T = ts.Node, R = unknown> = (node: T, context: SourceContext) => R | Rule<T, R>;
