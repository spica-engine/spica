import {Description, Runtime, SpawnOptions, Worker} from "@spica-server/function/runtime";
import * as child_process from "child_process";
import * as path from "path";
import {Transform, Writable} from "stream";

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
        "--es-module-specifier-resolution=node",
        `--experimental-loader=${path.join(__dirname, "runtime", "bootstrap")}`
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          FUNCTION_GRPC_ADDRESS: process.env.FUNCTION_GRPC_ADDRESS,
          ENTRYPOINT: "index",
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

  spawn(options: SpawnOptions): Worker {
    return new NodeWorker(options);
  }
}
