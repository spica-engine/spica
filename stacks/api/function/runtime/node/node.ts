import {
  Compilation,
  Description,
  Runtime,
  SpawnOptions,
  Worker
} from "@spica-server/function/runtime";
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import {Transform, Writable} from "stream";
import * as worker_threads from "worker_threads";

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

  kill() {
    this._process.kill("SIGKILL");
  }
}

export class Node extends Runtime {
  description: Description = {
    name: "node",
    title: "Node.js 12",
    description: "Node.js® is a JavaScript runtime built on Chrome's V8 JavaScript engine."
  };

  private compilationWorker: worker_threads.Worker;

  constructor() {
    super();
    this.compilationWorker = new worker_threads.Worker(__dirname + "/compiler_worker.js");
  }

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
    return new Promise((resolve, reject) => {
      const handleMessage = message => {
        if (message.baseUrl == compilation.cwd) {
          this.compilationWorker.off("message", handleMessage);
          if (message.diagnostics.length) {
            reject(message.diagnostics);
          } else {
            resolve();
          }
        }
      };
      this.compilationWorker.on("message", handleMessage);
      this.compilationWorker.postMessage(compilation);
    });
  }

  spawn(options: SpawnOptions): Worker {
    return new NodeWorker(options);
  }

  clear(compilation: Compilation) {
    return super.rimraf(path.join(compilation.cwd, ".build"));
  }
}
