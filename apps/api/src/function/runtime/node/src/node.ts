import {Description, Runtime, SpawnOptions, Worker} from "@spica-server/function/runtime";
import child_process from "child_process";
import {Writable} from "stream";
import path from "path";
import {fileURLToPath} from "url";

export class NodeWorker extends Worker {
  private _process: child_process.ChildProcess;
  private _quit = false;

  private get quit() {
    return this._process.killed || this._quit;
  }

  constructor(options: SpawnOptions) {
    super();

    const entrypointPath = options.entrypointPath || this.getEntrypointPath();
    this._process = child_process.spawn(
      `node`,
      ["--import=extensionless/register", entrypointPath],
      {
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
    this._process.once("exit", () => (this._quit = true));
    Object.assign(this, this._process);
  }

  attach(stdout?: Writable, stderr?: Writable): void {
    this._process.stdout.unpipe();
    this._process.stderr.unpipe();

    this._process.stdout.pipe(stdout);
    this._process.stderr.pipe(stderr);
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
