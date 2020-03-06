import {Compilation, Description, Execution, Runtime} from "@spica-server/function/runtime";
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import {Transform} from "stream";
import * as ts from "typescript";
import symlinkdir = require("symlink-dir");

class FilterExperimentalWarnings extends Transform {
  _transform(rawChunk: Buffer, encoding: string, cb: Function) {
    const chunk = rawChunk.toString();
    if (
      chunk.indexOf("ExperimentalWarning: The ESM module loader is experimental.") == -1 &&
      chunk.indexOf(
        "ExperimentalWarning: --experimental-loader is an experimental feature. This feature could change at any time"
      ) == -1
    ) {
      this.push(rawChunk, encoding);
      cb();
    } else {
      cb();
    }
  }
}

export class Node extends Runtime {
  description: Description = {
    name: "node",
    title: "Node.js 12",
    description: "Node.js® is a JavaScript runtime built on Chrome's V8 JavaScript engine."
  };

  async compile(compilation: Compilation): Promise<void> {
    await super.prepare(compilation);

    await symlinkdir(
      path.join(compilation.cwd, "node_modules", "@spica-devkit", "database"),
      path.join(compilation.cwd, "node_modules", "@internal", "database")
    ).catch(e => {
      console.log(e);
      if (e.code == "EEXIST" || e.code == "ENOENT") {
        // Do nothing.
        return;
      }
      return Promise.reject(e);
    });

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

    const entrypoint = path.resolve(compilation.cwd, compilation.entrypoint);

    const options: ts.CompilerOptions = {
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2018,
      outDir: path.resolve(compilation.cwd, ".build"),
      sourceMap: true,
      allowJs: true,
      skipDefaultLibCheck: true
    };

    const program = ts.createProgram({
      rootNames: [entrypoint],
      options
    });

    const result = program.emit();

    if (result.emitSkipped) {
      return Promise.reject("Compilation skipped.");
    }
  }

  async execute(execution: Execution): Promise<number> {
    return new Promise((resolve, reject) => {
      const worker = child_process.spawn(
        `node`,
        [
          "--experimental-modules",
          "--enable-source-maps",
          "--unhandled-rejections=strict",
          `--experimental-loader=${path.join(__dirname, "runtime", "bootstrap.js")}`
        ],
        {
          stdio: [
            "ignore",
            typeof execution.stdout == "string" ? execution.stdout : "pipe",
            typeof execution.stdout == "string" ? execution.stdout : "pipe"
          ],
          env: {
            PATH: process.env.PATH,
            EVENT_ID: execution.eventId,
            ENTRYPOINT: "index.js",
            RUNTIME: "node",
            __INTERNAL__SPICA__MONGOURL__: process.env.DATABASE_URI,
            __INTERNAL__SPICA__MONGODBNAME__: process.env.DATABASE_NAME,
            __INTERNAL__SPICA__MONGOREPL__: process.env.REPLICA_SET
          },
          cwd: path.join(execution.cwd, ".build")
        }
      );

      if (typeof execution.stdout == "object") {
        worker.stdout.pipe(execution.stdout);
        worker.stderr.pipe(new FilterExperimentalWarnings()).pipe(execution.stdout);
      }

      worker.once("error", e => {
        reject(e);
      });

      worker.once("exit", (code, signal) => {
        if (code == 0) {
          resolve(code);
        } else {
          reject(code);
        }
      });
    });
  }

  clear(compilation: Compilation) {
    return super.rimraf(path.join(compilation.cwd, ".build"));
  }
}
