import {Logger} from "@nestjs/common";
import path from "path";
import {fileURLToPath} from "url";
import worker_threads from "worker_threads";
import {BuildDiagnostic, BuildMeta} from "@spica-server/interface-function-builder";

export interface BundleRequest {
  id: number;
  language: string;
  meta: BuildMeta;
}

export interface BundleResponse {
  id: number;
  diagnostics: BuildDiagnostic[];
}

export class RollupWorkerHost {
  private readonly logger = new Logger(RollupWorkerHost.name);

  private worker: worker_threads.Worker;
  private lastId = 0;
  private pending = new Map<number, {resolve: () => void; reject: (e: unknown) => void}>();

  constructor(
    private workerPath?: string,
    private maxOldSpaceMb?: number
  ) {}

  run(language: string, meta: BuildMeta): Promise<void> {
    const worker = this.ensureWorker();
    const id = ++this.lastId;

    return new Promise<void>((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      worker.postMessage({id, language, meta} as BundleRequest);
    });
  }

  kill(): Promise<void> {
    if (!this.worker) {
      return Promise.resolve();
    }
    const worker = this.worker;
    this.worker = undefined;
    // The guarded exit handler below no longer rejects once this.worker is cleared, so fail any
    // in-flight build here — a deliberately terminated worker will never answer it.
    this.rejectAllPending("Bundler worker was terminated.");
    return worker.terminate().then(() => {});
  }

  private ensureWorker(): worker_threads.Worker {
    if (this.worker) {
      return this.worker;
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // A worker thread has its own heap. Bundling a large dependency graph can exhaust the
    // default (container-sized) heap and kill the worker, so let an operator raise it via
    // resourceLimits (worker execArgv rejects V8 flags like --max-old-space-size). Note a
    // --max-old-space-size on the api process itself is a hard ceiling this cannot exceed.
    // Unset -> node's default applies.
    const worker = new worker_threads.Worker(
      this.workerPath || path.join(__dirname, "rollup_worker.js"),
      this.maxOldSpaceMb
        ? {resourceLimits: {maxOldGenerationSizeMb: this.maxOldSpaceMb}}
        : undefined
    );
    this.worker = worker;

    worker.on("message", (response: BundleResponse) => this.settle(response));

    // Both handlers guard on `this.worker !== worker`: a dead worker's queued error/exit must not
    // clear a *newer* live worker or reject builds dispatched to it. Once a crashed worker has
    // been replaced (or killed), its late events are inert. Without this, worker A's error clears
    // the reference, a concurrent build spawns worker B, then A's trailing exit drops B and fails
    // B's build — RollupWorkerHost is shared per-language across concurrent builds.

    // A Worker is an EventEmitter: an 'error' event with no listener is rethrown by node and
    // takes the whole api process down. A heavy bundle exhausting the worker's heap
    // (ERR_WORKER_OUT_OF_MEMORY) surfaces here, so listen and fail the in-flight builds
    // instead of crashing. Dropping the reference lets the next build spawn a fresh worker.
    worker.on("error", error => {
      if (this.worker !== worker) {
        return;
      }
      this.logger.error(`Bundler worker crashed: ${error.message}`);
      this.worker = undefined;
      this.rejectAllPending(`Bundler worker crashed: ${error.message}`, "BUNDLER_WORKER_CRASH");
    });

    worker.once("exit", exitCode => {
      if (this.worker !== worker) {
        return;
      }
      this.worker = undefined;
      if (exitCode != 0) {
        this.logger.log("Bundler worker has quit with non-zero exit code.");
      }
      // A dead worker will never answer; fail any build still in flight (already drained if the
      // crash above fired first) so it fails instead of hanging.
      this.rejectAllPending(`Bundler worker has quit with exit code ${exitCode}.`);
    });

    return worker;
  }

  private settle({id, diagnostics}: BundleResponse) {
    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }
    this.pending.delete(id);
    if (diagnostics.length) {
      pending.reject(diagnostics);
    } else {
      pending.resolve();
    }
  }

  private rejectAllPending(reason: string, code = "BUNDLER_WORKER_EXIT") {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      pending.reject([
        {
          code,
          category: 1,
          text: reason,
          start: {line: 1, column: 1},
          end: {line: 1, column: 1}
        }
      ]);
    }
  }
}
