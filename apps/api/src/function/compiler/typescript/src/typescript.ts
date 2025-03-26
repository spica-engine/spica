import {Compilation, Description, Language} from "@spica-server/function/compiler";
import fs from "fs";
import {fromEvent, Observable, of, throwError} from "rxjs";
import {filter, switchMap, take, tap} from "rxjs/operators";
import worker_threads from "worker_threads";
import path from "path";
import {fileURLToPath} from "url";

export class Typescript extends Language {
  description: Description = {
    entrypoints: {
      build: "index.ts",
      runtime: "index.mjs"
    },
    name: "typescript",
    title: "Typescript"
  };

  private worker: worker_threads.Worker;

  private message$: Observable<any>;

  constructor(private compilerPath?: string) {
    super();
  }

  async compile(compilation: Compilation): Promise<void> {
    if (!this.worker) {
      this.worker = this.initiateWorker();

      this.worker.once("exit", exitCode => {
        this.worker = undefined;
        if (exitCode != 0) {
          console.log("Compiler worker has quit with non-zero exit code.");
        }
      });
      this.message$ = fromEvent<any>(this.worker, "message");
    }
    await super.prepare(compilation);

    await fs.promises
      .symlink(
        path.join(compilation.cwd, "node_modules"),
        path.join(compilation.cwd, compilation.outDir, "node_modules"),
        "dir"
      )
      .catch(e => {
        if (e.code == "EEXIST") {
          // Do nothing.
          return;
        }
        return Promise.reject(e);
      });

    setImmediate(() => {
      // Sometimes the worker responds faster than we could capture hence
      // the observable below just hangs indefinitely till the next message comes
      // so we post the message after the observer subscribes
      this.worker.postMessage(compilation);
    });

    return this.message$
      .pipe(
        filter(message => message.baseUrl == compilation.cwd),
        switchMap(message => {
          if (message.diagnostics.length) {
            return throwError(message.diagnostics);
          }
          return of(null);
        }),
        take(1)
      )
      .toPromise();
  }

  kill() {
    if (this.worker) {
      return this.worker.terminate().then(() => {});
    }
    return Promise.resolve();
  }

  private initiateWorker() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const compilerPath = this.compilerPath || path.join(__dirname, "typescript_worker.js");
    return new worker_threads.Worker(compilerPath);
  }
}
