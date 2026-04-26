import {Worker} from "@spica-server/function-runtime";
import child_process from "child_process";
import {Writable} from "stream";
import path from "path";
import {fileURLToPath} from "url";
import {SpawnOptions} from "@spica-server/interface-function-runtime";

export class PythonWorker extends Worker {
  private _process: child_process.ChildProcess;
  private _quit = false;

  private get quit() {
    return this._process.killed || this._quit;
  }

  constructor(options: SpawnOptions) {
    super();
    const bootstrapPath = options.entrypointPath || this.getBootstrapPath();
    const python = process.env.FUNCTION_PYTHON_EXECUTABLE || "python3";
    this._process = child_process.spawn(python, [bootstrapPath], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        FUNCTION_GRPC_ADDRESS: process.env.FUNCTION_GRPC_ADDRESS,
        ENTRYPOINT: "index.py",
        RUNTIME: "python",
        WORKER_ID: options.id,
        // Force unbuffered stdio so logs flush in real time.
        PYTHONUNBUFFERED: "1",
        // Avoid writing __pycache__ inside per-event synthetic modules.
        PYTHONDONTWRITEBYTECODE: "1",
        ...options.env
      }
    });
    this._process.once("exit", () => (this._quit = true));
    Object.assign(this, this._process);
  }

  attach(stdout?: Writable, stderr?: Writable): void {
    this._process.stdout!.unpipe();
    this._process.stderr!.unpipe();

    this._process.stdout!.pipe(stdout!);
    this._process.stderr!.pipe(stderr!);
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

  private getBootstrapPath() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.join(__dirname, "..", "bootstrap", "main.py");
  }
}
