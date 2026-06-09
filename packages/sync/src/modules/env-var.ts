import path from "path";
import {diffObjectFields, renderSchemaDetail} from "../planner";
import {readLocalSchemas, removeDir, sanitizeSlug, unwrapList, writeYaml} from "../fs-utils";
import {ResourceModule} from "../types";

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

  readLocal(rootDir) {
    return readLocalSchemas<EnvVar>(rootDir, "env-var");
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
    return renderSchemaDetail(local.data, remote.data, IGNORED_FIELDS);
  },

  summaryLine(resource) {
    return `key: ${resource.data.key}`;
  },

  extractLocalId(data) {
    return data._id;
  }
};
