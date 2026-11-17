import {Entity} from "@spica-server/data-postgresql-orm";
import {
  activities,
  apiKeys,
  assets,
  buckets,
  configs,
  dashboards,
  envVars,
  functionLogs,
  functions,
  identities,
  jobs,
  policies,
  preferences,
  refreshTokens,
  secrets,
  statuses,
  storageObjects,
  strategies,
  users,
  verifications,
  webhookLogs,
  webhooks
} from "../../entities/index.js";

export const COLLECTION_ENTITIES: Readonly<Record<string, Entity>> = {
  activity: activities,
  apikey: apiKeys,
  asset: assets,
  buckets,
  config: configs,
  dashboard: dashboards,
  env_var: envVars,
  function: functions,
  function_logs: functionLogs,
  identity: identities,
  jobs,
  policies,
  preferences,
  refresh_token: refreshTokens,
  secret: secrets,
  status: statuses,
  storage: storageObjects,
  strategy: strategies,
  user: users,
  verification: verifications,
  webhook: webhooks,
  webhook_logs: webhookLogs
};

export function entityOf(collection: string): Entity {
  const entity = COLLECTION_ENTITIES[collection];
  if (!entity) {
    throw new Error(`There is no collection named "${collection}" on PostgreSQL.`);
  }
  return entity;
}
