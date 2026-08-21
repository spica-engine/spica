import path from "path";
import fs from "fs";
import yaml from "yaml";
import isEqual from "lodash/isEqual.js";
import {bold, cyan, green, red, yellow} from "colorette";
import {SyncHttpClient} from "../http";
import {buildUnifiedDiff, diffObjectFields, formatError} from "../planner";
import {
  ensureDir,
  listFolders,
  omit,
  readText,
  readYaml,
  removeDir,
  sanitizeSlug,
  unwrapList,
  writeText,
  writeYaml
} from "../fs-utils";
import {DevEventContext, LocalResource, RemoteResource, ResourceModule} from "../types";

interface FunctionSchema {
  _id?: string;
  name: string;
  language?: string;
  timeout?: number;
  triggers?: Record<string, unknown>;
  [key: string]: unknown;
}

interface RemoteDependency {
  name: string;
  version: string;
}

/** Full local representation including code and deps */
export interface FunctionData {
  schema: FunctionSchema;
  /** Source code string */
  index: string;
  /** Map of dep name → version string (e.g. "@scope/pkg": "^1.0.0") */
  dependencies: Record<string, string>;
}

const SCHEMA_IGNORED = ["_id", "env_vars", "secrets"];

function indexFilename(language?: string): string {
  return language === "typescript" ? "index.ts" : "index.mjs";
}

/** Extract an ObjectId string from either a plain string or a resolved object with `_id`. */
function extractId(v: unknown): string {
  if (v && typeof v === "object" && "_id" in (v as object)) {
    return String((v as Record<string, unknown>)._id);
  }
  return String(v);
}

/** Normalize env_vars / secrets fields to arrays of plain ID strings. */
function normalizeSchema(schema: FunctionSchema): FunctionSchema {
  const normalized: FunctionSchema = {...schema};
  if (Array.isArray(schema.env_vars)) {
    normalized.env_vars = (schema.env_vars as unknown[]).map(extractId);
  }
  if (Array.isArray(schema.secrets)) {
    normalized.secrets = (schema.secrets as unknown[]).map(extractId);
  }
  return normalized;
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const c = error as {
    status?: number;
    statusCode?: number;
    response?: {status?: number; statusCode?: number};
  };
  const status = c.status ?? c.statusCode ?? c.response?.status ?? c.response?.statusCode;
  return typeof status === "number" ? status : undefined;
}

function isNotFoundError(error: unknown): boolean {
  return errorStatus(error) === 404;
}

// ─── Remote detail fetching ──────────────────────────────────────────────────
// `readRemote` needs two extra requests per function (index + dependencies). On
// an instance with many functions, firing them all at once gets requests
// throttled or dropped, and a dropped request used to be read as "remote is
// empty" — which surfaced as a change that does not exist. So: bound the
// concurrency, retry what is worth retrying, and refuse to guess otherwise.

const DEFAULT_FETCH_CONCURRENCY = 5;
const DEFAULT_FETCH_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 300;

function positiveEnvNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/** Transport errors (no status), throttling and server errors are worth a retry. */
function isRetryableError(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === undefined) return true;
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryRequest<T>(op: () => Promise<T>, retries: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await op();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === retries) throw error;
      await delay(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastError;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runner = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };

  const runners = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({length: runners}, runner));
  return results;
}

// ─── Extended interface with granular read/write operations ──────────────────

export interface FunctionModule extends ResourceModule<FunctionData> {
  // ── Granular reads (sync) ──────────────────────────────────────────────────
  readSchema(rootDir: string, slug: string): FunctionSchema | null;
  readIndex(rootDir: string, slug: string, language?: string): string;
  readDependencies(rootDir: string, slug: string): Record<string, string>;
  // ── Granular writes (async) ────────────────────────────────────────────────
  /** POST schema → returns the new remote _id, or undefined on failure. */
  createSchema(http: SyncHttpClient, schema: FunctionSchema): Promise<string | undefined>;
  /** PUT schema + sync env_vars/secrets. */
  updateSchema(http: SyncHttpClient, remoteId: string, schema: FunctionSchema): Promise<void>;
  /** POST the index file content. */
  uploadIndex(http: SyncHttpClient, remoteId: string, index: string): Promise<void>;
  /** Delta-sync dependencies (add new / remove missing). */
  uploadDependencies(
    http: SyncHttpClient,
    remoteId: string,
    deps: Record<string, string>
  ): Promise<void>;
}

export const functionModule: FunctionModule = {
  name: "function",
  displayName: "Function",
  identityField: "name",
  ignoredFields: SCHEMA_IGNORED,

  readSchema(rootDir, slug) {
    return readYaml<FunctionSchema>(path.join(rootDir, "function", slug, "schema.yaml"));
  },

  readIndex(rootDir, slug, language) {
    return readText(path.join(rootDir, "function", slug, indexFilename(language))) ?? "";
  },

  readDependencies(rootDir, slug) {
    const pkgText = readText(path.join(rootDir, "function", slug, "package.json"));
    if (!pkgText) return {};
    try {
      return JSON.parse(pkgText).dependencies ?? {};
    } catch {
      return {};
    }
  },

  async readLocal(rootDir) {
    const dir = path.join(rootDir, "function");
    const slugs = listFolders(dir);
    const results: LocalResource<FunctionData>[] = [];

    for (const slug of slugs) {
      const schema = this.readSchema(rootDir, slug);
      if (!schema) continue;
      const index = this.readIndex(rootDir, slug, schema.language);
      const dependencies = this.readDependencies(rootDir, slug);
      results.push({slug, data: {schema, index, dependencies}});
    }
    return results;
  },

  async readRemote(http) {
    const concurrency = positiveEnvNumber("SPICA_SYNC_CONCURRENCY", DEFAULT_FETCH_CONCURRENCY);
    const retries = positiveEnvNumber("SPICA_SYNC_RETRIES", DEFAULT_FETCH_RETRIES);

    const res = await retryRequest(
      () => http.get<FunctionSchema[] | {data: FunctionSchema[]}>("function"),
      retries
    );
    const fns = unwrapList(res);

    const failures: string[] = [];

    const resources = await mapWithConcurrency(fns, concurrency, async fn => {
      const id = fn._id!;

      const [indexRes, depsRes] = await Promise.all([
        retryRequest(() => http.get<{index: string}>(`function/${id}/index`), retries).catch(
          error => {
            // A function that has no source yet really is empty; anything else
            // is a failed read we must not mistake for one.
            if (isNotFoundError(error)) return {index: ""};
            failures.push(`${fn.name}: index (${formatError(error)})`);
            return undefined;
          }
        ),
        retryRequest(
          () => http.get<RemoteDependency[]>(`function/${id}/dependencies`),
          retries
        ).catch(error => {
          if (isNotFoundError(error)) return [] as RemoteDependency[];
          failures.push(`${fn.name}: dependencies (${formatError(error)})`);
          return undefined;
        })
      ]);

      if (indexRes === undefined || depsRes === undefined) return undefined;

      const dependencies: Record<string, string> = {};
      for (const dep of depsRes) {
        dependencies[dep.name] = dep.version;
      }

      return {
        slug: sanitizeSlug(fn.name),
        id,
        data: {
          schema: normalizeSchema(fn),
          index: indexRes.index ?? "",
          dependencies
        }
      };
    });

    if (failures.length) {
      throw new Error(
        `Could not read ${failures.length} remote function detail(s) after ${retries} retries, ` +
          `aborting instead of reporting changes that may not exist:\n  - ` +
          `${failures.join("\n  - ")}\n` +
          `Retry, or lower the request concurrency with SPICA_SYNC_CONCURRENCY ` +
          `(current: ${concurrency}).`
      );
    }

    return resources.filter((r): r is RemoteResource<FunctionData> => r !== undefined);
  },

  async create(http, local) {
    const id = await this.createSchema(http, local.data.schema);
    if (!id) return;
    await this.uploadIndex(http, id, local.data.index);
    await this.uploadDependencies(http, id, local.data.dependencies);
  },

  async createSchema(http, schema) {
    const created = await http.post<FunctionSchema>(
      "function",
      omit(schema, ["env_vars", "secrets"])
    );
    const id = (created._id ?? schema._id) as string | undefined;
    if (!id) return undefined;
    const envVarIds: string[] = (schema.env_vars as string[] | undefined) ?? [];
    await Promise.all(envVarIds.map(evId => http.put(`function/${id}/env-var/${evId}`, {})));
    const secretIds: string[] = (schema.secrets as string[] | undefined) ?? [];
    await Promise.all(secretIds.map(sId => http.put(`function/${id}/secret/${sId}`, {})));
    return id;
  },

  async update(http, local, remoteId) {
    await this.updateSchema(http, remoteId, local.data.schema);
    await this.uploadIndex(http, remoteId, local.data.index);
    await this.uploadDependencies(http, remoteId, local.data.dependencies);
  },

  async updateSchema(http, remoteId, schema) {
    await http.put(`function/${remoteId}`, omit(schema, ["env_vars", "secrets"]));

    const localEnvVarIds = new Set<string>((schema.env_vars as string[] | undefined) ?? []);
    const currentFn = await http
      .get<FunctionSchema>(`function/${remoteId}`)
      .then(normalizeSchema)
      .catch(() => ({}) as FunctionSchema);
    const remoteEnvVarIds = new Set<string>((currentFn.env_vars as string[] | undefined) ?? []);
    await Promise.all([
      ...[...localEnvVarIds]
        .filter(id => !remoteEnvVarIds.has(id))
        .map(id => http.put(`function/${remoteId}/env-var/${id}`, {})),
      ...[...remoteEnvVarIds]
        .filter(id => !localEnvVarIds.has(id))
        .map(id => http.delete(`function/${remoteId}/env-var/${id}`))
    ]);

    const localSecretIds = new Set<string>((schema.secrets as string[] | undefined) ?? []);
    const remoteSecretIds = new Set<string>((currentFn.secrets as string[] | undefined) ?? []);
    await Promise.all([
      ...[...localSecretIds]
        .filter(id => !remoteSecretIds.has(id))
        .map(id => http.put(`function/${remoteId}/secret/${id}`, {})),
      ...[...remoteSecretIds]
        .filter(id => !localSecretIds.has(id))
        .map(id => http.delete(`function/${remoteId}/secret/${id}`))
    ]);
  },

  async uploadIndex(http, remoteId, index) {
    await http.post(`function/${remoteId}/index`, {index});
  },

  async uploadDependencies(http, remoteId, localDeps) {
    const currentDeps = await http
      .get<RemoteDependency[]>(`function/${remoteId}/dependencies`)
      .catch(() => [] as RemoteDependency[]);

    const currentByName = new Map(currentDeps.map(d => [d.name, d.version]));

    const toDelete = currentDeps.filter(d => !(d.name in localDeps));
    await Promise.all(
      toDelete.map(d =>
        http.delete(`function/${remoteId}/dependencies/${d.name}`).catch(error => {
          if (isNotFoundError(error)) return;
          throw error;
        })
      )
    );

    const toAdd = Object.entries(localDeps)
      .filter(([n, v]) => {
        const cur = currentByName.get(n);
        return !cur || cur !== v;
      })
      .map(([n, v]) => `${n}@${v}`);

    if (toAdd.length) {
      await http.post(`function/${remoteId}/dependencies`, {name: toAdd});
    }
  },

  async delete(http, remoteId) {
    await http.delete(`function/${remoteId}`);
  },

  async writeLocal(rootDir, remote) {
    const fnDir = path.join(rootDir, "function", remote.slug);
    ensureDir(fnDir);

    writeYaml(path.join(fnDir, "schema.yaml"), remote.data.schema);

    const indexFile = indexFilename(remote.data.schema.language);
    writeText(path.join(fnDir, indexFile), remote.data.index);

    const pkg = {
      name: remote.slug,
      version: "0.0.1",
      dependencies: remote.data.dependencies
    };
    writeText(path.join(fnDir, "package.json"), JSON.stringify(pkg, null, 2));
  },

  async deleteLocal(rootDir, slug) {
    removeDir(path.join(rootDir, "function", slug));
  },

  diffFields(local, remote) {
    const changed: string[] = [];

    const schemaChanged = diffObjectFields(
      local.schema as Record<string, unknown>,
      remote.schema as Record<string, unknown>,
      SCHEMA_IGNORED
    );
    if (schemaChanged.length) changed.push("schema");

    if (local.index !== remote.index) changed.push("index");

    if (!isEqual(local.dependencies, remote.dependencies)) changed.push("dependencies");

    const localEnvVars: string[] = (local.schema.env_vars as string[] | undefined) ?? [];
    const remoteEnvVars: string[] = (remote.schema.env_vars as string[] | undefined) ?? [];
    if (!isEqual(new Set(localEnvVars), new Set(remoteEnvVars))) changed.push("env_vars");

    const localSecrets: string[] = (local.schema.secrets as string[] | undefined) ?? [];
    const remoteSecrets: string[] = (remote.schema.secrets as string[] | undefined) ?? [];
    if (!isEqual(new Set(localSecrets), new Set(remoteSecrets))) changed.push("secrets");

    return changed;
  },

  renderDetail(local, remote) {
    const result: Record<string, string> = {};

    const localSchemaYaml = yaml.stringify(omit(local.data.schema, SCHEMA_IGNORED));
    const remoteSchemaYaml = yaml.stringify(omit(remote.data.schema, SCHEMA_IGNORED));
    if (localSchemaYaml !== remoteSchemaYaml) {
      result["schema"] = buildUnifiedDiff(remoteSchemaYaml, localSchemaYaml, "schema.yaml");
    }

    if (local.data.index !== remote.data.index) {
      result["index"] = buildUnifiedDiff(
        remote.data.index,
        local.data.index,
        indexFilename(local.data.schema.language)
      );
    }

    const sortKeys = (obj: Record<string, string>) =>
      Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
    const localDepsYaml = yaml.stringify(sortKeys(local.data.dependencies));
    const remoteDepsYaml = yaml.stringify(sortKeys(remote.data.dependencies));
    if (localDepsYaml !== remoteDepsYaml) {
      result["dependencies"] = buildUnifiedDiff(remoteDepsYaml, localDepsYaml, "package.json");
    }

    return result;
  },

  summaryLine(resource) {
    const triggerCount = Object.keys(resource.data.schema.triggers ?? {}).length;
    return `${triggerCount} trigger${triggerCount !== 1 ? "s" : ""}`;
  },

  extractLocalId(data) {
    return data.schema._id;
  },

  watchedFiles: ["schema.yaml", "index.ts", "index.mjs", "index.js", "package.json"],

  async devHandleEvent(ctx: DevEventContext) {
    // `this` is the module object — enables test mocks to override granular methods
    const self = this as FunctionModule;
    const {
      type,
      slug,
      file,
      http,
      rootDir,
      warn,
      spin,
      refreshState,
      getRemoteId,
      setRemoteId,
      clearRemoteId,
      schedulePendingDelete,
      consumePendingDeleteByRemoteId
    } = ctx;

    const isIndexFile = (f: string) => f === "index.ts" || f === "index.mjs" || f === "index.js";
    const isPackageFile = (f: string) => f === "package.json";

    function fnLabel(symbol: string, forSlug: string, sub?: string): string {
      const parts = [symbol, bold(self.displayName), bold(forSlug)];
      if (sub) parts.push(yellow(`[${sub}]`));
      return parts.join("  ");
    }

    async function waitForRemoteId(): Promise<string | undefined> {
      for (let attempt = 0; attempt < 10; attempt++) {
        const id = getRemoteId(slug);
        if (id) return id;
        await ctx.sleep(200);
      }
      return getRemoteId(slug);
    }

    async function onSchemaAdd(): Promise<void> {
      const schema = self.readSchema(rootDir, slug);
      if (!schema) return;

      // Rename detection: _id matches a pending delete → it's a rename, not a create
      const newLocalId = schema._id as string | undefined;
      if (newLocalId) {
        const pending = consumePendingDeleteByRemoteId(newLocalId);
        if (pending) {
          clearRemoteId(pending.slug);
          setRemoteId(slug, pending.remoteId);
          const renameLabel = `${yellow("~")}  ${bold(self.displayName)}  ${bold(pending.slug)} ${cyan("→")} ${bold(slug)}`;
          await spin(renameLabel, "updated (rename)", () =>
            self.updateSchema(http, pending.remoteId, schema)
          );
          return;
        }
      }

      const remoteId = getRemoteId(slug);
      if (remoteId) {
        // Already tracked remotely — re-add is a schema update
        await spin(fnLabel(yellow("~"), slug, "schema"), "updated", () =>
          self.updateSchema(http, remoteId, schema)
        );
      } else {
        // Brand new function — create schema only; index and deps arrive via their own add events
        await spin(fnLabel(green("+"), slug), "created", async () => {
          const newRemoteId = await self.createSchema(http, schema);
          if (!newRemoteId) return;
          await refreshState();
        });
      }
    }

    // ── Dispatch ────────────────────────────────────────────────────────────
    // Each file type owns its own event handling:
    //   schema.yaml  add/change/unlink → schema lifecycle (create / update / schedule-delete)
    //   index.*      add/change        → uploadIndex only
    //   package.json add/change        → uploadDependencies only
    //   code unlink                    → warn only (delete schema.yaml to remove remotely)
    // For "add" events on code files, waitForRemoteId handles the race where
    // index/package arrive before schema.yaml has been processed.

    const isSchema = file === "schema.yaml";

    if (type === "add" && isSchema) {
      await onSchemaAdd();
    } else if (type === "change" && isSchema) {
      const id = getRemoteId(slug);
      if (id) {
        const schema = self.readSchema(rootDir, slug);
        if (schema) {
          await spin(fnLabel(yellow("~"), slug, "schema"), "updated", () =>
            self.updateSchema(http, id, schema)
          );
        }
      }
    } else if (type !== "unlink" && isIndexFile(file)) {
      const id = getRemoteId(slug) ?? (type === "add" ? await waitForRemoteId() : undefined);
      if (id) {
        const schema = self.readSchema(rootDir, slug);
        const index = self.readIndex(rootDir, slug, schema?.language);
        await spin(fnLabel(yellow("~"), slug, "index"), "updated", () =>
          self.uploadIndex(http, id, index)
        );
      }
    } else if (type !== "unlink" && isPackageFile(file)) {
      const id = getRemoteId(slug) ?? (type === "add" ? await waitForRemoteId() : undefined);
      if (id) {
        const deps = self.readDependencies(rootDir, slug);
        await spin(fnLabel(yellow("~"), slug, "deps"), "updated", () =>
          self.uploadDependencies(http, id, deps)
        );
      }
    } else if (type === "unlink" && isSchema) {
      const id = getRemoteId(slug);
      if (id) schedulePendingDelete(slug, id);
    } else if (type === "unlink" && (isIndexFile(file) || isPackageFile(file))) {
      // Silently ignore — could be a rename; the corresponding "add" will re-upload.
      // Deleting only schema.yaml removes the remote function.
    }
  }
};
