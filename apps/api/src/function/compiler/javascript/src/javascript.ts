import {Compilation, Language, Description} from "@spica-server/function/compiler";
import * as fs from "fs";
import * as path from "path";

export class Javascript extends Language {
  readonly description: Description = {
    extension: "js",
    entrypoint: "index.mjs",
    name: "javascript",
    title: "Javascript"
  };
  async compile(compilation: Compilation): Promise<void> {
    await super.prepare(compilation);

    await fs.promises
      .symlink(
        path.join(compilation.cwd, "node_modules"),
        path.join(compilation.cwd, ".build", "node_modules"),
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
      path.join(compilation.cwd, "index.js"),
      path.join(compilation.cwd, ".build", this.description.entrypoint)
    );
  }

  kill() {
    return Promise.resolve();
  }
}
