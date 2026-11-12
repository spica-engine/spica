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

interface Secret {
  key: string;
  value?: string;
  [key: string]: unknown;
}

// "value" is excluded from diff/render: the API never returns it (projected out server-side),
// so comparing or displaying it would cause permanent false-positives and secret leakage.
// "updated_at" is server-managed, so it must be ignored for the same reason.
const IGNORED_FIELDS = [...KEY_FIELDS, "value", "updated_at"];

export const secretModule: ResourceModule<Secret> = {
  name: "secret",
  displayName: "Secret",
  identityField: "key",
  ignoredFields: IGNORED_FIELDS,

  readLocal(rootDir, source) {
    return readLocalSchemas<Secret>(rootDir, "secret", source);
  },

  async readRemote(http) {
    const res = await http.get<Secret[] | {data: Secret[]}>("secret");
    const items = unwrapList(res);
    return items.map(s => ({
      slug: sanitizeSlug(s.key),
      id: recordKey(s)!,
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
    writeLocalSchema(rootDir, "secret", remote);
  },

  async deleteLocal(rootDir, slug) {
    deleteLocalSchema(rootDir, "secret", slug);
  },

  diffFields(local, remote) {
    return diffSchemaFields(local, remote, IGNORED_FIELDS);
  },

  renderDetail(local, remote) {
    return renderSchemaDetail(local.data, remote.data, IGNORED_FIELDS);
  },

  summaryLine(resource) {
    return `key: ${resource.data.key}`;
  },

  extractLocalId(data) {
    return recordKey(data);
  }
};
