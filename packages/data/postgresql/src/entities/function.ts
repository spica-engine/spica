import {defineEntity, now} from "@spica-server/data-postgresql-orm";
import {Function} from "@spica-server/interface-function";
import {FunctionAsset} from "@spica-server/interface-function-asset-storage";
import {Log} from "@spica-server/interface-function-log";
import {Log as WebhookLog, Webhook} from "@spica-server/interface-function-webhook";

export const functions = defineEntity<Function>({
  table: "functions",
  idProperty: "_id",
  columns: {
    name: {type: "text", notNull: true},
    description: {type: "text"},
    env_vars: {type: "uuid[]", notNull: true, default: []},
    secrets: {type: "uuid[]", notNull: true, default: []},
    triggers: {type: "jsonb"},
    timeout: {type: "integer"},
    language: {type: "text"},
    warmWorkers: {type: "integer"},
    concurrencyPerWorker: {type: "integer"},
    order: {type: "double precision", column: "display_order"},
    category: {type: "text"}
  },
  indexes: [
    {columns: ["name"], unique: true},
    {columns: ["env_vars"], using: "gin"},
    {columns: ["secrets"], using: "gin"}
  ]
});

export const functionLogs = defineEntity<Log>({
  table: "function_logs",
  idProperty: "_id",
  columns: {
    function: {type: "uuid", column: "function_id", notNull: true},
    event_id: {type: "text"},
    content: {type: "text"},
    created_at: {type: "timestamptz", notNull: true, default: now()},
    channel: {type: "text"},
    level: {type: "integer"}
  },
  indexes: [
    {
      name: "function_logs_function_created_idx",
      columns: ["function", {property: "created_at", order: "desc"}]
    },
    {columns: ["created_at"]}
  ]
});

export const functionAssets = defineEntity<FunctionAsset>({
  table: "function_assets",
  idProperty: "_id",
  columns: {
    functionId: {type: "uuid", notNull: true},
    filename: {type: "text", notNull: true},
    key: {type: "text"},
    hash: {type: "text"},
    size: {type: "double precision"},
    uploadDate: {type: "timestamptz"},
    strategy: {type: "text"}
  },
  indexes: [{columns: ["functionId", "filename"], unique: true}]
});

export const webhooks = defineEntity<Webhook>({
  table: "webhooks",
  idProperty: "_id",
  columns: {
    title: {type: "text"},
    url: {type: "text"},
    body: {type: "text"},
    trigger: {
      embedded: {
        name: {type: "text"},
        active: {type: "boolean"},
        options: {embedded: {collection: {type: "text"}, type: {type: "text"}}}
      }
    }
  }
});

export const webhookLogs = defineEntity<WebhookLog>({
  table: "webhook_logs",
  idProperty: "_id",
  columns: {
    webhook: {type: "uuid", column: "webhook_id", notNull: true},
    succeed: {type: "boolean"},
    content: {type: "jsonb"},
    created_at: {type: "timestamptz", notNull: true, default: now()}
  },
  indexes: [{columns: ["webhook"]}, {columns: ["created_at"]}]
});
