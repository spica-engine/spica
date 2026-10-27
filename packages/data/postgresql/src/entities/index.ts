import {Entity} from "@spica-server/data-postgresql-orm";
import {
  apiKeys,
  identities,
  policies,
  refreshTokens,
  strategies,
  users,
  verifications
} from "./passport.js";
import {buckets, histories} from "./bucket.js";
import {configs} from "./config.js";
import {dashboards, envVars, secrets, statuses} from "./system.js";
import {functionAssets, functionLogs, functions, webhookLogs, webhooks} from "./function.js";
import {preferences} from "./preference.js";

export * from "./bucket.js";
export * from "./config.js";
export * from "./function.js";
export * from "./passport.js";
export * from "./preference.js";
export * from "./system.js";

export const systemEntities: readonly Entity[] = [
  identities,
  users,
  verifications,
  policies,
  apiKeys,
  refreshTokens,
  strategies,
  preferences,
  configs,
  functions,
  functionLogs,
  functionAssets,
  webhooks,
  webhookLogs,
  envVars,
  secrets,
  dashboards,
  statuses,
  buckets,
  histories
];
