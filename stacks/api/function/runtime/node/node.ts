import {Description, Runtime, SpawnOptions, Worker} from "@spica-server/function/runtime";
import * as child_process from "child_process";
import * as path from "path";
import {Writable} from "stream";

class NodeWorker extends Worker {
  private _process: child_process.ChildProcess;
  private _quit = false;

  private get quit() {
    return this._process.killed || this._quit;
  }

  constructor(options: SpawnOptions) {
    super();
    this._process = child_process.fork(
      path.join(__dirname, "runtime", "entrypoint", "bootstrap"),
      {
        execArgv: ["--es-module-specifier-resolution=node"],
        stdio: ["ignore", "pipe", "pipe", "ipc"],
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
      // `node`,
      // [
      //   "--es-module-specifier-resolution=node",
      //   path.join(__dirname, "runtime", "entrypoint", "bootstrap")
      // ],
      // {
      //   stdio: ["ignore", "pipe", "pipe"],
      //   env: {
      //     PATH: process.env.PATH,
      //     HOME: process.env.HOME,
      //     FUNCTION_GRPC_ADDRESS: process.env.FUNCTION_GRPC_ADDRESS,
      //     ENTRYPOINT: "index",
      //     RUNTIME: "node",
      //     WORKER_ID: options.id,
      //     ...options.env
      //   }
      // }
    );
    this._process.once("exit", () => (this._quit = true));
    Object.assign(this, this._process);
  }

  attach(stdout?: Writable, stderr?: Writable): void {
    this._process.stdout.unpipe();
    this._process.stderr.unpipe();

    this._process.stdout.pipe(stdout);
    this._process.stderr.pipe(stderr);

    this._process.on("message", console.log);

    this._process.on("debug", console.log);
    this._process.on("log", console.log);

    this._process.on("info", console.log);
    this._process.on("warn", console.log);
    this._process.on("error", console.log);
  }

  kill() {
    if (this.quit) {
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      this._process.once("exit", () => resolve());
      this._process.kill("SIGTERM");
    });
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
