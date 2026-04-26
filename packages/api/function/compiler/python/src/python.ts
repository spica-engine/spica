import {Language} from "@spica-server/function-compiler";
import child_process from "child_process";
import fs from "fs";
import path from "path";
import {Compilation, Description} from "@spica-server/interface-function-compiler";

/**
 * Python "compiler". Python is interpreted; we use this step to syntax-check
 * the source via ``python3 -m py_compile`` and stage the file under
 * ``<cwd>/.build/index.py`` so the runtime path is uniform across languages.
 */
export class Python extends Language {
  readonly description: Description = {
    entrypoints: {
      build: "index.py",
      runtime: "index.py"
    },
    name: "python",
    title: "Python"
  };

  private readonly executable = process.env.FUNCTION_PYTHON_EXECUTABLE || "python3";

  async compile(compilation: Compilation): Promise<void> {
    await super.prepare(compilation);
    const sourcePath = path.join(compilation.cwd, this.description.entrypoints.build);
    const outDirAbsolutePath = path.join(compilation.cwd, compilation.outDir);
    const targetPath = path.join(outDirAbsolutePath, this.description.entrypoints.runtime);

    await this.syntaxCheck(sourcePath);
    await fs.promises.copyFile(sourcePath, targetPath);
  }

  kill() {
    return Promise.resolve();
  }

  private syntaxCheck(file: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = child_process.spawn(
        this.executable,
        ["-c", "import ast,sys; ast.parse(open(sys.argv[1]).read(), sys.argv[1])", file],
        {stdio: ["ignore", "pipe", "pipe"]}
      );
      let stderr = "";
      proc.stderr.on("data", chunk => (stderr += chunk.toString()));
      proc.on("error", err => reject(err));
      proc.on("close", code => {
        if (code === 0) {
          return resolve();
        }
        reject([
          {
            code: 1,
            text: stderr.trim() || `Python syntax check failed (exit ${code}).`,
            start: {line: 1, column: 1},
            end: {line: 1, column: 1}
          }
        ]);
      });
    });
  }
}
