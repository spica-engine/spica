import path from "path";
import yaml from "yaml";
import isEqual from "lodash/isEqual.js";
import {httpService} from "../../../http";
import {buildUnifiedDiff, diffObjectFields} from "../planner";
import {ensureDir, listFolders, omit, readText, readYaml, removeDir, writeText, writeYaml} from "../fs-utils";
import {LocalResource, RemoteResource, ResourceModule} from "../types";

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

export const functionModule: ResourceModule<FunctionData> = {
  name: "function",
  displayName: "Function",
  identityField: "name",
  ignoredFields: SCHEMA_IGNORED,

  async readLocal(rootDir) {
    const dir = path.join(rootDir, "function");
    const slugs = listFolders(dir);
    const results: LocalResource<FunctionData>[] = [];

    for (const slug of slugs) {
      const fnDir = path.join(dir, slug);
      const schema = readYaml<FunctionSchema>(path.join(fnDir, "schema.yaml"));
      if (!schema) continue;

      const indexFile = indexFilename(schema.language);
      const index = readText(path.join(fnDir, indexFile)) ?? "";

      let dependencies: Record<string, string> = {};
      const pkgJson = readText(path.join(fnDir, "package.json"));
      if (pkgJson) {
        try {
          const parsed = JSON.parse(pkgJson);
          dependencies = parsed.dependencies ?? {};
        } catch {
          // Ignore malformed package.json
        }
      }

      results.push({slug, data: {schema, index, dependencies}});
    }
    return results;
  },

  async readRemote(http) {
    const fns = await http.get<FunctionSchema[]>("function");
    const results: RemoteResource<FunctionData>[] = [];

    for (const fn of fns) {
      const id = fn._id!;

      const [indexRes, depsRes] = await Promise.all([
        http.get<{index: string}>(`function/${id}/index`).catch(() => ({index: ""})),
        http.get<RemoteDependency[]>(`function/${id}/dependencies`).catch(() => [] as RemoteDependency[])
      ]);

      const dependencies: Record<string, string> = {};
      for (const dep of depsRes) {
        // Remote version looks like "^1.0.0"; dep.version may include the "^"
        dependencies[dep.name] = dep.version;
      }

      results.push({
        slug: fn.name,
        id,
        data: {
          schema: normalizeSchema(fn),
          index: indexRes.index ?? "",
          dependencies
        }
      });
    }

    return results;
  },

  async create(http, local) {
    const created = await http.post<FunctionSchema>("function", omit(local.data.schema, ["env_vars"]));
    const id = created._id ?? local.data.schema._id;
    if (!id) return;

    await http.post(`function/${id}/index`, {index: local.data.index});

    const depNames = Object.entries(local.data.dependencies)
      .filter(([n]) => !n.startsWith("file:"))
      .map(([n, v]) => `${n}@${v.replace(/^\^|^~/, "")}`);

    if (depNames.length) {
      await http.post(`function/${id}/dependencies`, {name: depNames});
    }

    const envVarIds: string[] = (local.data.schema.env_vars as string[] | undefined) ?? [];
    await Promise.all(
      envVarIds.map(evId => http.put(`function/${id}/env-var/${evId}`, {}))
    );

    const secretIds: string[] = (local.data.schema.secrets as string[] | undefined) ?? [];
    await Promise.all(
      secretIds.map(sId => http.put(`function/${id}/secret/${sId}`, {}))
    );
  },

  async update(http, local, remoteId) {
    await http.put(`function/${remoteId}`, omit(local.data.schema, ["env_vars", "secrets"]));
    await http.post(`function/${remoteId}/index`, {index: local.data.index});

    // Sync env_vars via inject/eject endpoints
    const localEnvVarIds = new Set<string>((local.data.schema.env_vars as string[] | undefined) ?? []);
    const currentFn = await http.get<FunctionSchema>(`function/${remoteId}`).then(normalizeSchema).catch(() => ({} as FunctionSchema));
    const remoteEnvVarIds = new Set<string>((currentFn.env_vars as string[] | undefined) ?? []);
    await Promise.all([
      ...[...localEnvVarIds].filter(id => !remoteEnvVarIds.has(id)).map(id =>
        http.put(`function/${remoteId}/env-var/${id}`, {})
      ),
      ...[...remoteEnvVarIds].filter(id => !localEnvVarIds.has(id)).map(id =>
        http.delete(`function/${remoteId}/env-var/${id}`)
      )
    ]);

    // Sync secrets via inject/eject endpoints
    const localSecretIds = new Set<string>((local.data.schema.secrets as string[] | undefined) ?? []);
    const remoteSecretIds = new Set<string>((currentFn.secrets as string[] | undefined) ?? []);
    await Promise.all([
      ...[...localSecretIds].filter(id => !remoteSecretIds.has(id)).map(id =>
        http.put(`function/${remoteId}/secret/${id}`, {})
      ),
      ...[...remoteSecretIds].filter(id => !localSecretIds.has(id)).map(id =>
        http.delete(`function/${remoteId}/secret/${id}`)
      )
    ]);

    // Re-fetch current remote deps to compute delta
    const currentDeps = await http
      .get<RemoteDependency[]>(`function/${remoteId}/dependencies`)
      .catch(() => [] as RemoteDependency[]);

    const currentByName = new Map(currentDeps.map(d => [d.name, d.version]));
    const localDeps = local.data.dependencies;

    // Delete deps not in local (skip file: deps)
    const toDelete = currentDeps.filter(
      d => !d.name.startsWith("file:") && !(d.name in localDeps)
    );
    await Promise.all(
      toDelete.map(d => http.delete(`function/${remoteId}/dependencies/${d.name}`).catch(() => {}))
    );

    // Add/update deps present in local but not matching remote
    const toAdd = Object.entries(localDeps)
      .filter(([n]) => !n.startsWith("file:"))
      .filter(([n, v]) => {
        const cur = currentByName.get(n);
        return !cur || cur !== v;
      })
      .map(([n, v]) => `${n}@${v.replace(/^\^|^~/, "")}`);

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
  }
};
