// permissionModules.ts
// Output shape:
// {
//   module: "bucket",
//   actions: [
//     { action: "bucket:index", resource?: {include:[], exclude:[]} },
//     ...
//   ]
// }

import { useMemo } from "react";

/* ----------------------------- Types ----------------------------- */

export type ResourceRule = {
  include: string[];
  exclude: string[];
};

export type PermissionStatement = {
  action: string;
  module: string;
  resource?: ResourceRule;
};

export type ModuleStatement = {
  module: string;
  actions: Array<{
    action: string;
    resource?: ResourceRule;
  }>;
};

/* ------------------------- Pure Helpers -------------------------- */

const normalizeResource = (r?: ResourceRule): ResourceRule | undefined => {
  if (!r) return undefined;
  return {
    include: [...(r.include ?? [])],
    exclude: [...(r.exclude ?? [])],
  };
};

// Dedupes by (action + resource content), order-insensitive
const actionKey = (a: { action: string; resource?: ResourceRule }) => {
  const r = a.resource;
  const inc = r ? [...(r.include ?? [])].sort().join("|") : "";
  const exc = r ? [...(r.exclude ?? [])].sort().join("|") : "";
  return `${a.action}__inc:${inc}__exc:${exc}`;
};

export function toModuleStatements(input: PermissionStatement[]): ModuleStatement[] {
  const list = (input ?? [])
    .filter((s): s is PermissionStatement => Boolean(s?.module && s?.action))
    .map((s) => ({
      module: s.module,
      action: s.action,
      resource: normalizeResource(s.resource),
    }));

  const moduleMap = new Map<string, Array<{ action: string; resource?: ResourceRule }>>();

  for (const st of list) {
    const arr = moduleMap.get(st.module);
    const next = { action: st.action, resource: st.resource };
    if (arr) arr.push(next);
    else moduleMap.set(st.module, [next]);
  }

  const out: ModuleStatement[] = [];

  for (const [module, actionsRaw] of moduleMap.entries()) {
    // dedupe (you have tons of duplicates in your sample)
    const dedup = new Map<string, { action: string; resource?: ResourceRule }>();
    for (const a of actionsRaw) dedup.set(actionKey(a), a);

    const actions = [...dedup.values()].sort((a, b) => a.action.localeCompare(b.action));

    out.push({ module, actions });
  }

  return out.sort((a, b) => a.module.localeCompare(b.module));
}

/* ---------------------------- Hook ------------------------------ */

export function useModuleStatements(statements: PermissionStatement[]) {
  return useMemo(() => toModuleStatements(statements), [statements]);
}
