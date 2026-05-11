import {httpService} from "../../http";

// ─── Dev-watcher extension types ─────────────────────────────────────────────

/**
 * Context object passed to a module's `devHandleEvent` hook.
 * Provides everything needed to react to a file change without coupling
 * the module to the dispatcher's internal data structures.
 *
 * All slug/remoteId operations are automatically scoped to the calling module.
 */
export interface DevEventContext {
  /** "add" | "change" | "unlink" — the chokidar event type */
  type: "add" | "change" | "unlink";
  /** The sub-directory name under <rootDir>/<moduleName>/ */
  slug: string;
  /** The filename within the slug dir (e.g. "schema.yaml", "index.ts") */
  file: string;
  /** The HTTP client for API calls */
  http: httpService.Client;
  /** Absolute path to the project root */
  rootDir: string;
  /** Retrieve the cached remote ID for this module's slug */
  getRemoteId(slug: string): string | undefined;
  /** Store a remote ID mapping after a create */
  setRemoteId(slug: string, id: string): void;
  /** Remove a remote ID mapping after a delete */
  clearRemoteId(slug: string): void;
  /**
   * Enqueue a pending delete for the given slug.
   * After `renameWindowMs` the delete is executed unless `consumePendingDeleteByRemoteId`
   * is called first with the matching remoteId (rename promotion).
   */
  schedulePendingDelete(slug: string, remoteId: string): void;
  /**
   * Find, cancel, and return any pending-delete entry whose remoteId matches.
   * Used for rename detection: call this on `add schema.yaml` with the new
   * file's `_id` — if it matches a pending delete, it's a rename, not a create.
   * Returns undefined when no match is found.
   */
  consumePendingDeleteByRemoteId(remoteId: string): {slug: string; remoteId: string} | undefined;
  /** Await a delay — honours fake timers in tests */
  sleep(ms: number): Promise<void>;
  /** Refresh the module's remote-ID state after a create/rename */
  refreshState(): Promise<void>;
  /** Info-level logger (replaces console.log) */
  log(msg: string): void;
  /** Warning-level logger (replaces console.warn) */
  warn(msg: string): void;
}

export enum ChangeKind {
  Create = "create",
  Update = "update",
  Delete = "delete"
}

export interface PlanEntry {
  kind: ChangeKind;
  slug: string;
  /** Human-readable summary line (e.g. "Pages (12 properties)") */
  summary: string;
  /** Changed field names; only relevant for Update */
  changedFields: string[];
  /** Full unified diff strings per sub-section; only relevant for Update + --detailed */
  diffs: Record<string, string>;
  /** Populated for Create and Update */
  local: LocalResource | undefined;
  /** Populated for Update and Delete */
  remote: RemoteResource | undefined;
}

export interface ModulePlan {
  module: ResourceModule;
  creates: PlanEntry[];
  updates: PlanEntry[];
  deletes: PlanEntry[];
}

export interface Plan {
  modules: ModulePlan[];
}

/**
 * Strategy interface — one implementation per resource type.
 * Adding a new module = one new file implementing this interface.
 */
export interface ResourceModule<T = any> {
  /** Identifier used in --module filter and folder name on disk */
  name: string;
  /** Pretty label shown in plan output */
  displayName: string;
  /** Remote field whose value becomes the folder slug on disk */
  identityField: string;
  /**
   * Fields excluded from deep-equality when detecting updates.
   * Typically server-generated timestamps or internal IDs that vary without
   * representing a real user-visible change.
   */
  ignoredFields: string[];

  /**
   * Extract a stable server-assigned ID from local data (e.g. `_id` written by a
   * previous fetch). When provided, buildPlan uses it to detect renames: a local
   * resource whose identity field changed but whose `_id` matches a remote-only
   * entry is promoted to an update instead of a delete + create pair.
   */
  extractLocalId?(data: T): string | undefined;

  /** Read all local resources from the project directory */
  readLocal(rootDir: string): Promise<LocalResource<T>[]>;
  /** Fetch all remote resources from the Spica API */
  readRemote(http: httpService.Client): Promise<RemoteResource<T>[]>;

  /** Apply a create to the remote API */
  create(http: httpService.Client, local: LocalResource<T>): Promise<void>;
  /** Apply an update to the remote API; remoteId is the _id on the server */
  update(http: httpService.Client, local: LocalResource<T>, remoteId: string): Promise<void>;
  /** Delete a remote resource */
  delete(http: httpService.Client, remoteId: string): Promise<void>;

  /** Write a remote resource to disk */
  writeLocal(rootDir: string, remote: RemoteResource<T>): Promise<void>;
  /** Remove local resource folder from disk */
  deleteLocal(rootDir: string, slug: string): Promise<void>;

  /**
   * Return names of top-level fields that differ between local and remote
   * representations (after stripping ignoredFields).
   */
  diffFields(local: T, remote: T): string[];
  /**
   * Return a unified-diff string for the --detailed view.
   * Multiple sections (e.g. function has schema/index/deps) are keyed separately.
   */
  renderDetail(local: LocalResource<T>, remote: RemoteResource<T>): Record<string, string>;
  /** One-liner shown in plan output; e.g. "Pages (12 properties)" */
  summaryLine(resource: LocalResource<T> | RemoteResource<T>): string;

  /**
   * File names (relative to the slug dir) that the dev watcher should track.
   * Defaults to `["schema.yaml"]` when omitted.
   * Used both to filter chokidar events and to build the watch-ignored predicate.
   *
   * Example — function module: `["schema.yaml", "index.ts", "index.mjs", "index.js", "package.json"]`
   */
  watchedFiles?: string[];

  /**
   * Handle a single file-change event from the dev watcher.
   *
   * When provided, the dispatcher calls this instead of its default schema-only
   * handler, giving the module full control over create/update/delete logic for
   * all file types it owns.
   *
   * When absent, the dispatcher falls back to the built-in schema-only behaviour:
   * - `add`    → create or update via `schema.yaml`
   * - `change` → update via `schema.yaml`
   * - `unlink` → schedule delete (with rename-window promotion)
   */
  devHandleEvent?(ctx: DevEventContext): Promise<void>;
}

export interface LocalResource<T = any> {
  /** Derived from folder name on disk */
  slug: string;
  data: T;
}

export interface RemoteResource<T = any> {
  /** Derived from identityField on the remote object */
  slug: string;
  /** Remote _id; used for update / delete API calls */
  id: string;
  data: T;
}
