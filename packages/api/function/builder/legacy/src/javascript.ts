import {linkNodeModules, prepareOutDir} from "@spica-server/function-builder";
import fs from "fs";
import path from "path";
import {BuildMeta, BuildStrategy, Description} from "@spica-server/interface-function-builder";

export class JavascriptBuild implements BuildStrategy {
  readonly description: Description = {
    entrypoints: {
      build: "index.mjs",
      runtime: "index.mjs"
    },
    name: "javascript",
    title: "Javascript"
  };

  async build(meta: BuildMeta): Promise<void> {
    await prepareOutDir(meta);
    await linkNodeModules(meta);

    await fs.promises.copyFile(
      path.join(meta.cwd, this.description.entrypoints.build),
      path.join(meta.cwd, meta.outDir, this.description.entrypoints.runtime)
    );
  }

  kill() {
    return Promise.resolve();
  }
}
