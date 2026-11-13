import {diffSchemaFields, renderSchemaDetail} from "../planner";
import {
  deleteLocalSchema,
  readLocalSchemas,
  sanitizeSlug,
  unwrapList,
  writeLocalSchema
} from "../fs-utils";
import {ResourceModule} from "../types";
import {KEY_FIELDS, recordKey} from "../record-key";

interface Bucket {
  title: string;
  description?: string;
  primary?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

const IGNORED_FIELDS = [...KEY_FIELDS, "order"];
const UNORDERED_PATHS = ["required", "properties.**.required", "indexes"];

export const bucketModule: ResourceModule<Bucket> = {
  name: "bucket",
  displayName: "Bucket",
  identityField: "title",
  ignoredFields: IGNORED_FIELDS,
  unorderedPaths: UNORDERED_PATHS,

  readLocal(rootDir, source) {
    return readLocalSchemas<Bucket>(rootDir, "bucket", source);
  },

  async readRemote(http) {
    const res = await http.get<Bucket[] | {data: Bucket[]}>("bucket");
    const buckets = unwrapList(res);
    return buckets.map(b => ({
      slug: sanitizeSlug(b.title),
      id: recordKey(b)!,
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
    writeLocalSchema(rootDir, "bucket", remote);
  },

  async deleteLocal(rootDir, slug) {
    deleteLocalSchema(rootDir, "bucket", slug);
  },

  diffFields(local, remote) {
    return diffSchemaFields(local, remote, IGNORED_FIELDS, UNORDERED_PATHS);
  },

  renderDetail(local, remote) {
    return renderSchemaDetail(local.data, remote.data, IGNORED_FIELDS, UNORDERED_PATHS);
  },

  summaryLine(resource) {
    const propCount = Object.keys(resource.data.properties ?? {}).length;
    return `${propCount} properties`;
  },

  extractLocalId(data) {
    return recordKey(data);
  }
};
