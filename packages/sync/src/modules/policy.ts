import {SyncHttpClient} from "../http";
import {diffSchemaFields, renderSchemaDetail} from "../planner";
import {deleteLocalSchema, omit, readLocalSchemas, sanitizeSlug, writeLocalSchema} from "../fs-utils";
import {LocalResource, RemoteResource, ResourceModule} from "../types";

interface Policy {
  _id?: string;
  name: string;
  description?: string;
  actions?: string[];
  statement?: unknown[];
  [key: string]: unknown;
}

const IGNORED_FIELDS = ["_id", "system"];

export const policyModule: ResourceModule<Policy> = {
  name: "policy",
  displayName: "Policy",
  identityField: "name",
  ignoredFields: IGNORED_FIELDS,

  readLocal(rootDir) {
    return readLocalSchemas<Policy>(rootDir, "policy");
  },

  async readRemote(http) {
    const res = await http.get<{data: Policy[]} | Policy[]>("passport/policy");
    // The policy endpoint may paginate and return {data: [...]}
    const items: Policy[] = Array.isArray(res) ? res : ((res as any).data ?? []);
    // Filter out system policies which cannot be modified
    return items
      .filter(p => !p.system)
      .map(p => ({
        slug: sanitizeSlug(p.name),
        id: p._id!,
        data: p
      }));
  },

  async create(http, local) {
    const body = omit(local.data, ["system"]);
    await http.post("passport/policy", body);
  },

  async update(http, local, remoteId) {
    const body = omit(local.data, ["system"]);
    await http.put(`passport/policy/${remoteId}`, body);
  },

  async delete(http, remoteId) {
    await http.delete(`passport/policy/${remoteId}`);
  },

  async writeLocal(rootDir, remote) {
    writeLocalSchema(rootDir, "policy", remote);
  },

  async deleteLocal(rootDir, slug) {
    deleteLocalSchema(rootDir, "policy", slug);
  },

  diffFields(local, remote) {
    return diffSchemaFields(local, remote, IGNORED_FIELDS);
  },

  renderDetail(local, remote) {
    return renderSchemaDetail(local.data, remote.data, IGNORED_FIELDS);
  },

  summaryLine(resource) {
    const stmts = (resource.data.statement as any[])?.length ?? 0;
    return `${stmts} statement${stmts !== 1 ? "s" : ""}`;
  },

  extractLocalId(data) {
    return data._id;
  }
};
