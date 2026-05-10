import {httpService} from "../../http";

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
