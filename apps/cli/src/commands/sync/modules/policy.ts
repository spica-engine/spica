import path from "path";
import yaml from "yaml";
import {httpService} from "../../../http";
import {buildUnifiedDiff, diffObjectFields} from "../planner";
import {listFolders, omit, readYaml, removeDir, writeYaml} from "../fs-utils";
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

  async readLocal(rootDir) {
    const dir = path.join(rootDir, "policy");
    const slugs = listFolders(dir);
    const results: LocalResource<Policy>[] = [];
    for (const slug of slugs) {
      const data = readYaml<Policy>(path.join(dir, slug, "schema.yaml"));
      if (data) results.push({slug, data});
    }
    return results;
  },

  async readRemote(http) {
    const res = await http.get<{data: Policy[]} | Policy[]>("passport/policy");
    // The policy endpoint may paginate and return {data: [...]}
    const items: Policy[] = Array.isArray(res) ? res : ((res as any).data ?? []);
    // Filter out system policies which cannot be modified
    return items
      .filter(p => !p.system)
      .map(p => ({
        slug: p.name,
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
    const dir = path.join(rootDir, "policy", remote.slug);
    writeYaml(path.join(dir, "schema.yaml"), remote.data);
  },

  async deleteLocal(rootDir, slug) {
    removeDir(path.join(rootDir, "policy", slug));
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
    const stmts = (resource.data.statement as any[])?.length ?? 0;
    return `${stmts} statement${stmts !== 1 ? "s" : ""}`;
  }
};
