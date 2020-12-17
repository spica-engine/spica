import * as path from "path";
import {Transform, Writable} from "stream";
import * as child_process from "child_process";
import {SpawnOptions, Worker} from "./runtime";
import {discovery} from "./discovery";
import * as lock from "./lock";

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

export async function spawn(options: SpawnOptions): Promise<Worker> {
  let _process: child_process.ChildProcess;
  let _quit = false;

  const hasQuit = () => _process.killed || _quit;

  const runtime = await discovery.get(options.runtime.name);

  const [bin, ...args] = runtime.bin.split(" ");

  await lock.acquire(
    options.runtime.name,
    options.runtime.version,
    runtime.prepare,
    path.join(discovery.root, runtime.name)
  );

  _process = child_process.spawn(bin, args, {
    stdio: ["ignore", "pipe", "pipe"],
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

  return {
    once: _process.once.bind(_process),
    attach(stdout?: Writable, stderr?: Writable): void {
      _process.stdout.pipe(stdout);
      _process.stderr.pipe(new FilterExperimentalWarnings()).pipe(stderr);
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
