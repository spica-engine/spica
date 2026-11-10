import {Entity, fromRow, quote} from "@spica-server/data-postgresql-orm";
import {envVars, functions, identities, secrets, users} from "../../entities/index.js";
import type {CollectionReads} from "./reads.js";

type Record_ = Record<string, any>;

interface JoinedName {
  kind: "name";
  property: string;
  target: Entity;
  targetProperty: string;
}

interface Resolved {
  kind: "documents" | "name";
  property: string;
  target: Entity;
  targetProperty?: string;
}

interface Profile {
  joined: Record<string, JoinedName>;
  resolved: Record<string, Resolved>;
}

const PROFILES: Record<string, Profile> = {
  activity: {
    joined: {
      identifier: {
        kind: "name",
        property: "identifier",
        target: identities,
        targetProperty: "identifier"
      },
      username: {kind: "name", property: "username", target: users, targetProperty: "username"}
    },
    resolved: {}
  },
  function: {
    joined: {},
    resolved: {
      env_vars: {kind: "documents", property: "env_vars", target: envVars},
      secrets: {kind: "documents", property: "secrets", target: secrets}
    }
  },
  function_logs: {
    joined: {},
    resolved: {
      function: {kind: "name", property: "function", target: functions, targetProperty: "name"}
    }
  }
};

export interface ActiveRelations {
  joined: JoinedName[];
  resolved: Resolved[];
}

export function relationsOf(collection: string, names: string[] = []): ActiveRelations {
  const active: ActiveRelations = {joined: [], resolved: []};
  for (const name of names) {
    const profile = PROFILES[collection];
    if (profile?.joined[name]) {
      active.joined.push(profile.joined[name]);
    } else if (profile?.resolved[name]) {
      active.resolved.push(profile.resolved[name]);
    } else {
      throw new Error(`Collection ${collection} has no relation named ${name}.`);
    }
  }
  return active;
}

export function aliasOf(relation: JoinedName) {
  return `_${relation.property}`;
}

export function joinSql(relation: JoinedName, alias: string, idColumn: string, column: string) {
  const target = relation.target;
  return `LEFT JOIN ${quote(target.table)} AS ${quote(aliasOf(relation))} ON ${quote(aliasOf(relation))}.${quote(idColumn)} = ${quote(alias)}.${quote(column)}`;
}

export function nameSql(relation: JoinedName) {
  const column = relation.target.byProperty.get(relation.targetProperty)!.column;
  return `${quote(aliasOf(relation))}.${quote(column)}`;
}

function hiddenPaths(property: string, fields?: {[path: string]: 0 | 1}) {
  return Object.entries(fields ?? {})
    .filter(([path, flag]) => Number(flag) == 0 && path.startsWith(`${property}.`))
    .map(([path]) => path.slice(property.length + 1).split("."));
}

function omit(document: Record_, path: string[]) {
  const [head, ...rest] = path;
  if (!rest.length) {
    delete document[head];
  } else if (document[head] && typeof document[head] == "object") {
    omit(document[head], rest);
  }
}

export async function resolveRelations(
  reads: Pick<CollectionReads, "rowsWithIds">,
  records: Record_[],
  relations: Resolved[],
  fields?: {[path: string]: 0 | 1}
) {
  for (const relation of relations) {
    const hidden = relation.kind == "documents" ? hiddenPaths(relation.property, fields) : [];
    const ids = [
      ...new Set(
        records.flatMap(record => {
          const value = record[relation.property];
          return (Array.isArray(value) ? value : [value]).filter(id => id != null).map(String);
        })
      )
    ];
    if (!ids.length) {
      continue;
    }
    const rows = await reads.rowsWithIds(relation.target, ids);
    const found = new Map(
      rows.map(row => {
        const record = fromRow(relation.target, row) as Record_;
        const id = String(record[relation.target.idProperty]);
        hidden.forEach(path => omit(record, path));
        return [id, record];
      })
    );

    for (const record of records) {
      const value = record[relation.property];
      if (value == null) {
        continue;
      }
      if (relation.kind == "documents") {
        record[relation.property] = (value as unknown[])
          .map(id => found.get(String(id)))
          .filter(document => document);
      } else {
        const target = found.get(String(value));
        record[relation.property] = target?.[relation.targetProperty!] ?? value;
      }
    }
  }
}
