import path from "path";
import yaml from "yaml";
import {httpService} from "../../../http";
import {buildUnifiedDiff, diffObjectFields} from "../planner";
import {listFolders, omit, readYaml, removeDir, writeYaml} from "../fs-utils";
import {LocalResource, RemoteResource, ResourceModule} from "../types";

interface Secret {
  _id?: string;
  key: string;
  value?: string;
  [key: string]: unknown;
}

const IGNORED_FIELDS = ["_id"];

export const secretModule: ResourceModule<Secret> = {
  name: "secret",
  displayName: "Secret",
  identityField: "key",
  ignoredFields: IGNORED_FIELDS,

  async readLocal(rootDir) {
    const dir = path.join(rootDir, "secret");
    const slugs = listFolders(dir);
    const results: LocalResource<Secret>[] = [];
    for (const slug of slugs) {
      const data = readYaml<Secret>(path.join(dir, slug, "schema.yaml"));
      if (data) results.push({slug, data});
    }
    return results;
  },

  async readRemote(http) {
    const items = await http.get<Secret[]>("secret");
    return items.map(s => ({
      slug: s.key,
      id: s._id!,
      data: s
    }));
  },

  async create(http, local) {
    await http.post("secret", local.data);
  },

  async update(http, local, remoteId) {
    await http.put(`secret/${remoteId}`, local.data);
  },

  async delete(http, remoteId) {
    await http.delete(`secret/${remoteId}`);
  },

  async writeLocal(rootDir, remote) {
    const dir = path.join(rootDir, "secret", remote.slug);
    writeYaml(path.join(dir, "schema.yaml"), remote.data);
  },

  async deleteLocal(rootDir, slug) {
    removeDir(path.join(rootDir, "secret", slug));
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
  }
};
