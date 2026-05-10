import path from "path";
import yaml from "yaml";
import {httpService} from "../../../http";
import {buildUnifiedDiff, diffObjectFields} from "../planner";
import {listFolders, omit, readYaml, removeDir, writeYaml} from "../fs-utils";
import {LocalResource, RemoteResource, ResourceModule} from "../types";

interface Bucket {
  _id?: string;
  title: string;
  description?: string;
  primary?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

const IGNORED_FIELDS = ["_id"];

export const bucketModule: ResourceModule<Bucket> = {
  name: "bucket",
  displayName: "Bucket",
  identityField: "title",
  ignoredFields: IGNORED_FIELDS,

  async readLocal(rootDir) {
    const dir = path.join(rootDir, "bucket");
    const slugs = listFolders(dir);
    const results: LocalResource<Bucket>[] = [];
    for (const slug of slugs) {
      const data = readYaml<Bucket>(path.join(dir, slug, "schema.yaml"));
      if (data) results.push({slug, data});
    }
    return results;
  },

  async readRemote(http) {
    const buckets = await http.get<Bucket[]>("bucket");
    return buckets.map(b => ({
      slug: b.title,
      id: b._id!,
      data: b
    }));
  },

  async create(http, local) {
    await http.post("bucket", local.data);
  },

  async update(http, local, remoteId) {
    await http.put(`bucket/${remoteId}`, local.data);
  },

  async delete(http, remoteId) {
    await http.delete(`bucket/${remoteId}`);
  },

  async writeLocal(rootDir, remote) {
    const dir = path.join(rootDir, "bucket", remote.slug);
    writeYaml(path.join(dir, "schema.yaml"), remote.data);
  },

  async deleteLocal(rootDir, slug) {
    removeDir(path.join(rootDir, "bucket", slug));
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
    const propCount = Object.keys(resource.data.properties ?? {}).length;
    return `${propCount} properties`;
  }
};
