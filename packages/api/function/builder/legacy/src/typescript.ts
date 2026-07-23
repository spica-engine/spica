import {linkNodeModules, prepareOutDir} from "@spica-server/function-builder";
import {BuildMeta, BuildStrategy, Description} from "@spica-server/interface-function-builder";
import {fromEvent, Observable, of, throwError} from "rxjs";
import {filter, switchMap, take} from "rxjs/operators";
import worker_threads from "worker_threads";
import path from "path";
import {fileURLToPath} from "url";
import {Logger} from "@nestjs/common";

export class TypescriptBuild implements BuildStrategy {
  private readonly logger = new Logger(TypescriptBuild.name);

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

  constructor(private compilerPath?: string) {}

  async build(meta: BuildMeta): Promise<void> {
    if (!this.worker) {
      this.worker = this.initiateWorker();

      this.worker.once("exit", exitCode => {
        this.worker = undefined;
        if (exitCode != 0) {
          this.logger.log("Compiler worker has quit with non-zero exit code.");
        }
      });
      this.message$ = fromEvent<any>(this.worker, "message");
    }
    await prepareOutDir(meta);
    await linkNodeModules(meta);

    setImmediate(() => {
      // Sometimes the worker responds faster than we could capture hence
      // the observable below just hangs indefinitely till the next message comes
      // so we post the message after the observer subscribes
      this.worker.postMessage(meta);
    });

    return this.message$
      .pipe(
        filter(message => message.baseUrl == meta.cwd),
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
