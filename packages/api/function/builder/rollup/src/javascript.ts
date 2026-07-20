import {linkNodeModules, prepareOutDir} from "@spica-server/function-builder";
import {BuildMeta, BuildStrategy, Description} from "@spica-server/interface-function-builder";
import {RollupWorkerHost} from "./worker-host.js";

export class JavascriptBundle implements BuildStrategy {
  readonly description: Description = {
    entrypoints: {
      build: "index.mjs",
      runtime: "index.mjs"
    },
    name: "javascript",
    title: "Javascript"
  };

  constructor(private host: RollupWorkerHost) {}

  async build(meta: BuildMeta): Promise<void> {
    await prepareOutDir(meta);
    await linkNodeModules(meta);
    return this.host.run(this.description.name, meta);
  }

  kill() {
    return this.host.kill();
  }
}
