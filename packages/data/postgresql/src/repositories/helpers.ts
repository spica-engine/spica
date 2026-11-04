import {addToSet, Entity, has, Orm, pull} from "@spica-server/data-postgresql-orm";
import {EntryStatus, Id} from "@spica-server/interface-data";

export async function assertCapacity(orm: Orm, entity: Entity, limit: number | undefined) {
  if (limit && (await orm.count(entity)) + 1 > limit) {
    throw new Error("Maximum number of documents has been reached");
  }
}

export async function entryStatus(
  orm: Orm,
  entity: Entity,
  limit: number | undefined
): Promise<EntryStatus> {
  return {limit, current: await orm.count(entity), unit: "count"};
}

export function omitPaths<R>(record: R | null, paths: string[]): R | null {
  if (!record) {
    return null;
  }
  const copy = structuredClone(record) as Record<string, any>;
  for (const path of paths) {
    const keys = path.split(".");
    const last = keys.pop();
    const parent = keys.reduce((value, key) => value?.[key], copy);
    if (parent && typeof parent == "object") {
      delete parent[last];
    }
  }
  return copy as R;
}

export function addPolicy<R>(orm: Orm, entity: Entity<R>, id: Id, policyId: string) {
  return orm.updateById(entity, id, {policies: addToSet(policyId)});
}

export function removePolicy<R>(orm: Orm, entity: Entity<R>, id: Id, policyId: string) {
  return orm.updateById(entity, id, {policies: pull(policyId)});
}

export async function removePolicyFromAll(orm: Orm, entity: Entity, policyId: string) {
  return (await orm.updateMany(entity, {policies: has(policyId)}, {policies: pull(policyId)}))
    .length;
}

export const hasOwn = (node: object, key: string) =>
  Object.prototype.hasOwnProperty.call(node, key);

function defineOwn(node: Record<string, any>, key: string, value: unknown) {
  Object.defineProperty(node, key, {value, writable: true, enumerable: true, configurable: true});
}

const isObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value == "object";

export function setPath(target: Record<string, any>, path: string[], value: unknown) {
  const last = path[path.length - 1];
  const parent = path.slice(0, -1).reduce((node, key) => {
    if (!hasOwn(node, key) || !isObject(node[key])) {
      defineOwn(node, key, {});
    }
    return node[key];
  }, target);
  defineOwn(parent, last, value);
}

export function unsetPath(target: Record<string, any>, path: string[]) {
  const last = path[path.length - 1];
  const parent = path
    .slice(0, -1)
    .reduce<unknown>(
      (node, key) => (isObject(node) && hasOwn(node, key) ? node[key] : undefined),
      target
    );
  if (isObject(parent) && hasOwn(parent, last)) {
    delete parent[last];
  }
}
