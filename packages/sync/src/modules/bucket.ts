import path from "path";
import {diffObjectFields, renderSchemaDetail} from "../planner";
import {readLocalSchemas, removeDir, sanitizeSlug, unwrapList, writeYaml} from "../fs-utils";
import {ResourceModule} from "../types";

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

  readLocal(rootDir) {
    return readLocalSchemas<Bucket>(rootDir, "bucket");
  },

  async readRemote(http) {
    const res = await http.get<Bucket[] | {data: Bucket[]}>("bucket");
    const buckets = unwrapList(res);
    return buckets.map(b => ({
      slug: sanitizeSlug(b.title),
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
    return renderSchemaDetail(local.data, remote.data, IGNORED_FIELDS);
  },

  summaryLine(resource) {
    const propCount = Object.keys(resource.data.properties ?? {}).length;
    return `${propCount} properties`;
  },

  extractLocalId(data) {
    return data._id;
  }
};
