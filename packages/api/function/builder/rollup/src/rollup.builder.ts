import {Builder} from "@spica-server/function-builder";
import {BuildStrategy} from "@spica-server/interface-function-builder";
import {JavascriptBundle} from "./javascript.js";
import {TypescriptBundle} from "./typescript.js";
import {RollupWorkerHost} from "./worker-host.js";

export class RollupBuilder extends Builder {
  protected strategies: Map<string, BuildStrategy>;

  private host: RollupWorkerHost;

  constructor(language: string, options: {workerPath?: string} = {}) {
    super(language);
    this.host = new RollupWorkerHost(options.workerPath);
    this.strategies = new Map<string, BuildStrategy>([
      ["javascript", new JavascriptBundle(this.host)],
      ["typescript", new TypescriptBundle(this.host)]
    ]);
  }

  kill() {
    return this.host.kill();
  }
}
