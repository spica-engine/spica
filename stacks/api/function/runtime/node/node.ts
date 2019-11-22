import {Compilation, Runtime, Execution} from "@spica-server/function/runtime";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import * as child_process from "child_process";

export class Node extends Runtime {
  name: string = this.constructor.name;

  async compile(compilation: Compilation): Promise<void> {
    await super.prepare(compilation);

    await fs.promises.symlink(
      path.join(compilation.cwd, "node_modules"),
      path.join(compilation.cwd, ".build", "node_modules"),
      "dir"
    );

    const entrypoint = path.resolve(compilation.cwd, compilation.entrypoint);

    const program = ts.createProgram({
      rootNames: [entrypoint],
      options: {
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2018,
        outDir: path.resolve(compilation.cwd, ".build"),
        sourceMap: true,
        allowJs: true,
        skipDefaultLibCheck: true
      }
    });

    program.emit();
  }

  execute(execution: Execution): Promise<number> {
    return new Promise((resolve, reject) => {
      const worker = child_process.fork(path.join(__dirname, "entrypoint.js"), [], {
        stdio: "inherit",
        env: {
          ENTRYPOINT: "index.js"
        },
        cwd: path.join(execution.cwd, ".build"),
        detached: true
      });

      worker.once("error", e => {
        reject(e);
      });

      worker.once("exit", (code, signal) => {
        resolve(code);
        console.log(code, signal);
      });
    });
  }

  clear(compilation: Compilation) {
    return super.rimraf(path.join(compilation.cwd, ".build"));
  }
}
