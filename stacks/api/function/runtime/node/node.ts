import {
  Compilation,
  Description,
  Diagnostic,
  Runtime,
  SpawnOptions,
  Worker
} from "@spica-server/function/runtime";
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import {Transform, Writable} from "stream";
import * as ts from "typescript";

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

class NodeWorker extends Worker {
  private _process: child_process.ChildProcess;

  constructor(options: SpawnOptions) {
    super();
    this._process = child_process.spawn(
      `node`,
      [
        "--experimental-modules",
        "--enable-source-maps",
        "--unhandled-rejections=strict",
        `--experimental-loader=${path.join(__dirname, "runtime", "bootstrap.js")}`
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          FUNCTION_GRPC_ADDRESS: process.env.FUNCTION_GRPC_ADDRESS,
          ENTRYPOINT: "index.js",
          RUNTIME: "node",
          WORKER_ID: options.id,
          ...options.env
        }
      }
    );
    Object.assign(this, this._process);
  }

  attach(stdout?: Writable, stderr?: Writable): void {
    this._process.stdout.pipe(stdout);
    this._process.stderr.pipe(new FilterExperimentalWarnings()).pipe(stderr);
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

    const entrypoint = path.resolve(compilation.cwd, compilation.entrypoint);

    const options: ts.CompilerOptions = {
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2018,
      outDir: path.resolve(compilation.cwd, ".build"),
      sourceMap: true,
      allowJs: true,
      skipDefaultLibCheck: true,
      alwaysStrict: true,
      preserveSymlinks: true,
      incremental: true,
      tsBuildInfoFile: path.resolve(compilation.cwd, ".build", ".tsbuildinfo")
    };

    const program = ts.createIncrementalProgram({
      rootNames: [entrypoint],
      options
    });

    program.emit();

    const semanticDiagnostics = program.getSemanticDiagnostics();

    if (semanticDiagnostics.length) {
      return Promise.reject(
        semanticDiagnostics.map(diagnostic => {
          const start = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
          const end = ts.getLineAndCharacterOfPosition(
            diagnostic.file,
            diagnostic.start + diagnostic.length
          );
          return <Diagnostic>{
            code: diagnostic.code,
            category: diagnostic.category,
            text: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
            start: {
              line: start.line + 1,
              column: start.character + 1
            },
            end: {
              line: end.line + 1,
              column: end.character + 1
            }
          };
        })
      );
    }
  }

  spawn(options: SpawnOptions): Worker {
    return new NodeWorker(options);
  }

  clear(compilation: Compilation) {
    return super.rimraf(path.join(compilation.cwd, ".build"));
  }
}
