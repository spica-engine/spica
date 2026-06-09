export type ImagePullPolicy = "if-not-present" | "always";

/** The resource modules the sync engine understands (also the folder names on disk). */
export type ResourceModuleName = "bucket" | "function" | "policy" | "env-var" | "secret";

/**
 * Which resources to install. Maps a module name to `true` (install every resource of that
 * module) or a list of resource folder names (install only those). Modules left out are not
 * installed at all. Selecting a resource does not pull in its dependencies (a function's
 * `@spica-fn/*` siblings, referenced buckets/env-vars) — list the complete set you need.
 *
 * Use this to install only the slice a feature test touches instead of the whole project, so
 * each test file boots fast.
 */
export type ResourceSelection = Partial<Record<ResourceModuleName, true | string[]>>;

export interface StartOptions {
  /** spicaengine/api image tag. Default "latest". */
  version?: string;
  /** mongo image tag. Default "8.0". */
  mongoVersion?: string;
  /** Root folder holding CLI-format resources (bucket/, function/, ...). Default "./". */
  resourcePath?: string;
  /** Host port the api will be published on. A free port is picked automatically when omitted. */
  port?: number;
  /** Instance/namespace name. Auto-generated ("spica-test-<hex>") when omitted. */
  name?: string;
  /** Identifier of the default identity. Default "spica". */
  identifier?: string;
  /** Password of the default identity. Default "spica". */
  password?: string;
  /** --master-key value. Defaults to a random 16-byte hex string. */
  masterKey?: string;
  /**
   * Extra api flags, e.g. {"activity-stream": false}. Applied before the generated
   * infrastructure flags, so the instance-critical ones (database-*, public-url,
   * persistent-path) always take precedence over a colliding override.
   */
  apiOptions?: Record<string, string | number | boolean>;
  /** Image pull policy. Default "if-not-present". */
  imagePullPolicy?: ImagePullPolicy;
  /**
   * What to install from resourcePath after the api boots:
   * - `true` (default) — install every resource,
   * - `false` — install nothing,
   * - a {@link ResourceSelection} — install only the named modules/resources (faster bring-up).
   */
  installResources?: boolean | ResourceSelection;
  /** How long to wait for the api to accept logins (POST /passport/identify) before failing. Default 120_000 ms. */
  readyTimeoutMs?: number;
}

export type ResetModule =
  | "bucket-data"
  | "bucket"
  | "identity"
  | "apikey"
  | "function"
  | "storage"
  | "all";

export interface TeardownOptions {
  /** Keep the data volumes instead of removing them. Default false. */
  retainVolumes?: boolean;
}

/**
 * A disposable Spica instance. The package owns only its lifecycle — start (+ install),
 * reset between tests, and teardown — and exposes nothing else. Everything a test does with
 * the running server (authenticating, creating api keys, making requests, writing
 * expectations) is the test writer's job: point the other devkits (@spica-devkit/auth,
 * @spica-devkit/identity, …) or raw HTTP at `publicUrl`, authenticating with the credentials
 * passed to start() (default identifier/password "spica"/"spica").
 */
export interface SpicaInstance {
  /** Host-reachable api base url, e.g. "http://localhost:54231" (NO /api suffix - there is no ingress). */
  readonly publicUrl: string;

  /** Wait until the api accepts a login (its readiness gate), or the timeout elapses. */
  waitForReady(timeoutMs?: number): Promise<void>;
  /** Quickly wipe state between tests by dropping the targeted mongo collections. */
  reset(modules?: ResetModule[]): Promise<void>;
  /** Stop and remove every container, network and (unless retained) volume of this instance. */
  teardown(options?: TeardownOptions): Promise<void>;
}
