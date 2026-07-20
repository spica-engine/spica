import {Builder} from "@spica-server/function-builder";
import {BuildStrategy} from "@spica-server/interface-function-builder";
import {JavascriptBuild} from "./javascript.js";
import {TypescriptBuild} from "./typescript.js";

export class LegacyBuilder extends Builder {
  protected strategies: Map<string, BuildStrategy>;

  constructor(language: string, options: {tsCompilerPath?: string} = {}) {
    super(language);
    this.strategies = new Map<string, BuildStrategy>([
      ["javascript", new JavascriptBuild()],
      ["typescript", new TypescriptBuild(options.tsCompilerPath)]
    ]);
  }
}
