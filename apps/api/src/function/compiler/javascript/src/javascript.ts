import {Compilation, Language, Description} from "@spica-server/function/compiler";
import fs from "fs";
import path from "path";

export class Javascript extends Language {
  readonly description: Description = {
    extension: "mjs",
    entrypoint: "index.mjs",
    name: "javascript",
    title: "Javascript"
  };
  async compile(compilation: Compilation): Promise<void> {
    await super.prepare(compilation);
    const outDirAbsolutePath = path.join(compilation.cwd, compilation.outDir);
    await fs.promises
      .symlink(
        path.join(compilation.cwd, "node_modules"),
        path.join(outDirAbsolutePath, "node_modules"),
        "dir"
      )
      .catch(e => {
        if (e.code == "EEXIST") {
          // Do nothing.
          return;
        }
        return Promise.reject(e);
      });

    await fs.promises.copyFile(
      path.join(compilation.cwd, this.description.entrypoint),
      path.join(outDirAbsolutePath, this.description.entrypoint)
    );
  }

  kill() {
    return Promise.resolve();
  }
}
