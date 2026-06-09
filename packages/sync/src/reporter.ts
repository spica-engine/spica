/**
 * Progress-reporting seam for the sync engine.
 *
 * The engine (`buildPlan` / `applyPlan` / `fetchToDisk`) runs long I/O bound
 * operations. In the CLI those should surface as terminal spinners; in a
 * programmatic context (e.g. `@spica-devkit/testing`) they should stay silent.
 *
 * Rather than hard-wiring `ora`/`console` into the engine, callers inject a
 * `SyncReporter`. When omitted, the engine uses {@link silentReporter} so the
 * default behaviour is no output at all.
 */
export interface SyncReporter {
  /**
   * Wrap a labeled async operation. Implementations may show a spinner while
   * `op` runs; the silent default just awaits it.
   */
  task<T>(label: string, op: () => Promise<T>): Promise<T>;

  /**
   * Begin a determinate progress operation over `total` items. Returns a handle
   * the engine updates as items complete.
   */
  progress(label: string, total: number): SyncProgress;

  /** Report a non-fatal warning (only reached when `abortOnError` is false). */
  warn(message: string): void;
}

export interface SyncProgress {
  /** Advance progress after an item finishes. */
  update(slug: string, done: number, total: number): void;
  /** Mark the whole operation as succeeded. */
  succeed(): void;
  /** Mark the whole operation as failed. */
  fail(): void;
}

const noopProgress: SyncProgress = {
  update() {},
  succeed() {},
  fail() {}
};

/** A reporter that produces no output; used when the caller passes none. */
export const silentReporter: SyncReporter = {
  task: (_label, op) => op(),
  progress: () => noopProgress,
  warn() {}
};
