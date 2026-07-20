import {prepareOutDir} from "@spica-server/function-builder";
import {BuildMeta, BuildStrategy, Description} from "@spica-server/interface-function-builder";
import {RollupWorkerHost} from "./worker-host.js";

export class TypescriptBundle implements BuildStrategy {
  readonly description: Description = {
    entrypoints: {
      build: "index.ts",
      runtime: "index.mjs"
    },
    name: "typescript",
    title: "Typescript"
  };

  constructor(private host: RollupWorkerHost) {}

  async build(meta: BuildMeta): Promise<void> {
    await prepareOutDir(meta);
    return this.host.run(this.description.name, meta);
  }

  kill() {
    return this.host.kill();
  }
}
