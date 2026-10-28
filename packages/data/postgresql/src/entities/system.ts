import {defineEntity} from "@spica-server/data-postgresql-orm";
import {Dashboard} from "@spica-server/interface-dashboard";
import {EnvVar} from "@spica-server/interface-env_var";
import {Secret} from "@spica-server/interface-secret";

export const envVars = defineEntity<EnvVar>({
  table: "env_vars",
  idProperty: "_id",
  columns: {
    key: {type: "text", notNull: true},
    value: {type: "text"},
    updated_at: {type: "timestamptz"}
  },
  indexes: [{columns: ["key"], unique: true}]
});

export const secrets = defineEntity<Secret>({
  table: "secrets",
  idProperty: "_id",
  columns: {
    key: {type: "text", notNull: true},
    value: {type: "jsonb"},
    updated_at: {type: "timestamptz"}
  },
  indexes: [{columns: ["key"], unique: true}]
});

export const dashboards = defineEntity<Dashboard>({
  table: "dashboards",
  idProperty: "_id",
  columns: {
    name: {type: "text"},
    icon: {type: "text"},
    components: {type: "jsonb", notNull: true, default: []}
  }
});

export const statuses = defineEntity<Record<string, unknown>>({
  table: "statuses",
  columns: {
    minute: {type: "timestamptz", notNull: true},
    created_at: {type: "timestamptz", notNull: true, default: "now()"},
    count: {type: "double precision", notNull: true, default: 0},
    requestSize: {type: "double precision", notNull: true, default: 0},
    responseSize: {type: "double precision", notNull: true, default: 0}
  },
  indexes: [{columns: ["minute"], unique: true}]
});
