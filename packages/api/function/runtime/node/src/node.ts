import {Worker} from "@spica-server/function-runtime";
import child_process from "child_process";
import {Writable} from "stream";
import path from "path";
import {fileURLToPath} from "url";
import {SpawnOptions} from "@spica-server/interface-function-runtime";

export class NodeWorker extends Worker {
  private _process: child_process.ChildProcess;
  private _quit = false;
  private _attachedStdouts: Writable[] = [];
  private _attachedStderrs: Writable[] = [];

  private get quit() {
    return this._process.killed || this._quit;
  }

  constructor(options: SpawnOptions) {
    super();
    const entrypointPath = options.entrypointPath || this.getEntrypointPath();
    this._process = child_process.spawn(`node`, [entrypointPath], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        FUNCTION_GRPC_ADDRESS: process.env.FUNCTION_GRPC_ADDRESS,
        ENTRYPOINT: "index.mjs",
        RUNTIME: "node",
        WORKER_ID: options.id,
        ...options.env
      }
    });
    this._process.once("exit", () => (this._quit = true));
    Object.assign(this, this._process);
  }

  attach(stdout?: Writable, stderr?: Writable): void {
    if (stdout) {
      this._attachedStdouts.push(stdout);
      this._process.stdout.pipe(stdout);
    }
    if (stderr) {
      this._attachedStderrs.push(stderr);
      this._process.stderr.pipe(stderr);
    }
  }

  detach(): void {
    if (this._process.stdout) {
      for (const stdout of this._attachedStdouts) {
        this._process.stdout.unpipe(stdout);
      }
    }
    if (this._process.stderr) {
      for (const stderr of this._attachedStderrs) {
        this._process.stderr.unpipe(stderr);
      }
    }
    this._attachedStdouts = [];
    this._attachedStderrs = [];
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

  private getEntrypointPath() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.join(__dirname, "..", "bootstrap", "entrypoint.js");
  }
}
