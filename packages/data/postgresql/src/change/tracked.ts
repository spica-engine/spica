import {Entity} from "@spica-server/data-postgresql-orm";
import {
  apiKeys,
  buckets,
  commands,
  configs,
  dashboards,
  envVars,
  functionAssets,
  functionLogs,
  functions,
  identities,
  policies,
  preferences,
  refreshTokens,
  secrets,
  systemEntities,
  users,
  webhooks
} from "../entities/index.js";
import {COLLECTION_ENTITIES} from "../query/collection/entities.js";

export interface TrackedTable {
  entity: Entity;
  beforeColumns?: string[];
}

export const trackedTables: readonly TrackedTable[] = [
  {entity: apiKeys},
  {entity: buckets},
  {entity: commands},
  {entity: configs},
  {entity: dashboards},
  {entity: envVars},
  {entity: functionAssets, beforeColumns: ["key"]},
  {entity: functionLogs},
  {entity: functions},
  {entity: identities},
  {entity: policies},
  {entity: preferences},
  {entity: refreshTokens},
  {entity: secrets},
  {entity: users},
  {entity: webhooks}
];

export function trackedEntityOf(collection: string): Entity | undefined {
  const entity =
    COLLECTION_ENTITIES[collection] ??
    systemEntities.find(candidate => candidate.table == collection);
  return trackedTables.some(tracked => tracked.entity === entity) ? entity : undefined;
}
