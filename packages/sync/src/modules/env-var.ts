import path from "path";
import yaml from "yaml";
import {SyncHttpClient} from "../http";
import {buildUnifiedDiff, diffObjectFields} from "../planner";
import {
  listFolders,
  omit,
  readYaml,
  removeDir,
  sanitizeSlug,
  unwrapList,
  writeYaml
} from "../fs-utils";
import {LocalResource, RemoteResource, ResourceModule} from "../types";

interface EnvVar {
  _id?: string;
  key: string;
  value?: string;
  [key: string]: unknown;
}

const IGNORED_FIELDS = ["_id"];

export const envVarModule: ResourceModule<EnvVar> = {
  name: "env-var",
  displayName: "Environment Variable",
  identityField: "key",
  ignoredFields: IGNORED_FIELDS,

  async readLocal(rootDir) {
    const dir = path.join(rootDir, "env-var");
    const slugs = listFolders(dir);
    const results: LocalResource<EnvVar>[] = [];
    for (const slug of slugs) {
      const data = readYaml<EnvVar>(path.join(dir, slug, "schema.yaml"));
      if (data) results.push({slug, data});
    }
    return results;
  },

  async readRemote(http) {
    const res = await http.get<EnvVar[] | {data: EnvVar[]}>("env-var");
    const items = unwrapList(res);
    return items.map(e => ({
      slug: sanitizeSlug(e.key),
      id: e._id!,
      data: e
    }));
  },

  async create(http, local) {
    await http.post("env-var", local.data);
  },

  async update(http, local, remoteId) {
    await http.put(`env-var/${remoteId}`, local.data);
  },

  async delete(http, remoteId) {
    await http.delete(`env-var/${remoteId}`);
  },

  async writeLocal(rootDir, remote) {
    const dir = path.join(rootDir, "env-var", remote.slug);
    writeYaml(path.join(dir, "schema.yaml"), remote.data);
  },

  async deleteLocal(rootDir, slug) {
    removeDir(path.join(rootDir, "env-var", slug));
  },

  diffFields(local, remote) {
    return diffObjectFields(
      local as Record<string, unknown>,
      remote as Record<string, unknown>,
      IGNORED_FIELDS
    );
  },

  renderDetail(local, remote) {
    const localYaml = yaml.stringify(omit(local.data, IGNORED_FIELDS));
    const remoteYaml = yaml.stringify(omit(remote.data, IGNORED_FIELDS));
    return {
      schema: buildUnifiedDiff(remoteYaml, localYaml, "schema.yaml")
    };
  },

  summaryLine(resource) {
    return `key: ${resource.data.key}`;
  },

  extractLocalId(data) {
    return data._id;
  }
};
