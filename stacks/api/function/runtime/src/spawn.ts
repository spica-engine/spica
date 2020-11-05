import * as path from "path";
import {Writable} from "stream";
import * as child_process from "child_process";
import {SpawnOptions, Worker} from "./runtime";
import {discovery} from "./discovery";

export async function spawn(options: SpawnOptions): Promise<Worker> {
  let _process: child_process.ChildProcess;
  let _quit = false;

  const hasQuit = () => _process.killed || _quit;

  const runtimes = await discovery.discover();

  const runtime = runtimes.get(options.runtime.name);

  const [bin, ...args] = runtime.bin.split(" ");

  _process = child_process.spawn(bin, args, {
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      HOME: process.env.HOME,
      FUNCTION_GRPC_ADDRESS: process.env.FUNCTION_GRPC_ADDRESS,
      WORKER_ID: options.id,
      VERSION: options.runtime.version,
      ...options.environment
    },
    cwd: path.join(discovery.root, runtime.name)
  });
  _process.once("exit", () => (this._quit = true));
  _process.on("error", console.log);

  console.log(_process.pid);

  return {
    once: _process.once.bind(_process),
    attach(stdout?: Writable, stderr?: Writable): void {
      _process.stdout.pipe(stdout);
      _process.stderr.pipe(stderr);
    },

    kill() {
      if (hasQuit()) {
        return Promise.resolve();
      }

      return new Promise<void>(resolve => {
        _process.once("exit", () => resolve());
        _process.kill("SIGKILL");
      });
    }
  };
}
