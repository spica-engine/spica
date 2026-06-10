import {diffSchemaFields, renderSchemaDetail} from "../planner";
import {deleteLocalSchema, readLocalSchemas, sanitizeSlug, unwrapList, writeLocalSchema} from "../fs-utils";
import {ResourceModule} from "../types";

interface Secret {
  _id?: string;
  key: string;
  value?: string;
  [key: string]: unknown;
}

// "value" is excluded from diff/render: the API never returns it (projected out server-side),
// so comparing or displaying it would cause permanent false-positives and secret leakage.
const IGNORED_FIELDS = ["_id", "value"];

export const secretModule: ResourceModule<Secret> = {
  name: "secret",
  displayName: "Secret",
  identityField: "key",
  ignoredFields: IGNORED_FIELDS,

  readLocal(rootDir) {
    return readLocalSchemas<Secret>(rootDir, "secret");
  },

  async readRemote(http) {
    const res = await http.get<Secret[] | {data: Secret[]}>("secret");
    const items = unwrapList(res);
    return items.map(s => ({
      slug: sanitizeSlug(s.key),
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
    return data._id;
  }
};
