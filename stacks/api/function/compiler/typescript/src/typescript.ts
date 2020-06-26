import {Compilation, Language, Description} from "@spica-server/function/compiler";
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
    this.worker = new worker_threads.Worker(__dirname + "/typescript_worker.js");
    this.worker.on("exit", exitCode => {
      if (exitCode != 0) {
        console.log("Compiler worker has quit with non-zero exit code.");
      }
    });
    this.message$ = fromEvent<any>(this.worker, "message");
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

    this.worker.postMessage(compilation);
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
    return this.worker.terminate().then(() => {});
  }
}
