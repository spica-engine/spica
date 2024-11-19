import {Compilation, Description, Language} from "@spica/api/src/function/compiler";
import * as fs from "fs";
import * as path from "path";
import {fromEvent, Observable, of, throwError} from "rxjs";
import {filter, switchMap, take} from "rxjs/operators";
import * as worker_threads from "worker_threads";

export class Typescript extends Language {
  description: Description = {
    extension: "ts",
    entrypoint: "index.js",
    name: "typescript",
    title: "Typescript"
  };

  private worker: worker_threads.Worker;

  private message$: Observable<any>;

  constructor() {
    super();
  }

  async compile(compilation: Compilation): Promise<void> {
    if (!this.worker) {
      this.worker = new worker_threads.Worker(path.join(__dirname, "typescript_worker.js"));
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
}
