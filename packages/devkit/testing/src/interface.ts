export type ImagePullPolicy = "if-not-present" | "always";

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
  /** --master-key value. Defaults to the instance name. */
  masterKey?: string;
  /**
   * Extra api flags, e.g. {"activity-stream": false}. Applied before the generated
   * infrastructure flags, so the instance-critical ones (database-*, public-url,
   * persistent-path) always take precedence over a colliding override.
   */
  apiOptions?: Record<string, string | number | boolean>;
  /** Image pull policy. Default "if-not-present". */
  imagePullPolicy?: ImagePullPolicy;
  /** Install the resources found in resourcePath after the api boots. Default true. */
  installResources?: boolean;
  /** How long to wait for GET /status/ready before failing. Default 120_000 ms. */
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

export interface ApiKeyInfo {
  _id: string;
  name: string;
  key: string;
}

export interface SpicaInstanceInfo {
  /** Namespace label applied to every docker resource of this instance. */
  name: string;
  /** Host-reachable api base url, e.g. "http://localhost:54231" (NO /api suffix - there is no ingress). */
  url: string;
  /** Same as `url`; provided for symmetry with the other devkits' initialize({publicUrl}). */
  publicUrl: string;
  /** Host-reachable mongo url with directConnection enabled (used by reset()). */
  mongoUrl: string;
  /** Database name the api was started with (equals `name`). */
  databaseName: string;
  /** IDENTITY token obtained by logging in as the default identity. */
  token: string;
  identifier: string;
  password: string;
  /** Auto-created, full-access api key. */
  apikey: ApiKeyInfo;
}

export interface CreateApiKeyOptions {
  /** Attach every policy returned by GET /passport/policy. Default true. */
  fullAccess?: boolean;
  /** Explicit policy ids to attach (in addition to fullAccess, if set). */
  policies?: string[];
}

export interface TeardownOptions {
  /** Keep the data volumes instead of removing them. Default false. */
  retainVolumes?: boolean;
}

export interface SpicaInstance extends SpicaInstanceInfo {
  /** Options object to initialize another devkit with this instance's IDENTITY token. */
  initializeOptionsIdentity(): {identity: string; publicUrl: string};
  /** Options object to initialize another devkit with this instance's api key. */
  initializeOptionsApikey(): {apikey: string; publicUrl: string};

  /** Log in as an arbitrary identity and return a fresh IDENTITY token. */
  loginAs(identifier: string, password: string, expires?: number): Promise<string>;
  /** Create an api key (full-access by default). */
  createApiKey(name: string, options?: CreateApiKeyOptions): Promise<ApiKeyInfo>;
  /** Wait until the api accepts a login (its readiness gate), or the timeout elapses. */
  waitForReady(timeoutMs?: number): Promise<void>;

  /** (Re)install the CLI-format resources from a folder (defaults to the start resourcePath). */
  installResources(resourcePath?: string): Promise<{errors: string[]}>;
  /** Quickly wipe state between tests by dropping the targeted mongo collections. */
  reset(modules?: ResetModule[]): Promise<void>;
  /** Stop and remove every container, network and (unless retained) volume of this instance. */
  teardown(options?: TeardownOptions): Promise<void>;
}
