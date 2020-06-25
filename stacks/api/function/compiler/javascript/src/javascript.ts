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
    const hasSpicaDevkitDatabasePackage = await fs.promises
      .access(path.join(compilation.cwd, "node_modules", "@spica-devkit"), fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);

    if (hasSpicaDevkitDatabasePackage) {
      const targetPath = path.join(compilation.cwd, "node_modules", "@internal");
      await fs.promises.mkdir(targetPath, {recursive: true});
      await fs.promises
        .symlink(
          path.join(compilation.cwd, "node_modules", "@spica-devkit", "database"),
          path.join(targetPath, "database"),
          "dir"
        )
        .catch(e => {
          if (e.code == "EEXIST" || e.code == "ENOENT") {
            // Do nothing.
            return;
          }
          return Promise.reject(e);
        });
    }

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
