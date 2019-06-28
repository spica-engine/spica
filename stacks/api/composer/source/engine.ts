import {virtualFs} from "@angular-devkit/core";
import * as ts from "typescript";
import {Rule, SourceContext} from "./interface";
import {callRule} from "./rules/call";

export class SourceEngine {
  compilerOptions: ts.CompilerOptions;
  compilerHost: ts.CompilerHost;
  program: ts.Program;

  constructor(private host: virtualFs.ScopedHost<object>) {
    this.compilerOptions = {
      maxNodeModuleJsDepth: 1,
      skipDefaultLibCheck: true,
      skipLibCheck: true,
      types: [],
      sourceMap: false,
      target: ts.ScriptTarget.ES2015
    };
    this.compilerHost = ts.createCompilerHost(this.compilerOptions, true);
    this.compilerHost.getCurrentDirectory = () => this.host["_root"];
  }

  createContext(): SourceContext {
    return {
      engine: this,
      program: this.program,
      host: this.host,
      root: this.host["_root"],
      transforms: []
    };
  }

  execute<R>(rule: Rule<null, R>): R {
    const ctx = this.createContext();
    return callRule(rule, null, ctx);
  }
}
