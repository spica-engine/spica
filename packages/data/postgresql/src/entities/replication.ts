import {defineEntity, now} from "@spica-server/data-postgresql-orm";
import {CommandMessage} from "@spica-server/interface-replication";

export const commands = defineEntity<CommandMessage>({
  table: "commands",
  idProperty: "_id",
  columns: {
    source: {type: "jsonb", notNull: true},
    target: {type: "jsonb", notNull: true},
    created_at: {type: "timestamptz", notNull: true, default: now()}
  },
  indexes: [{columns: ["created_at"]}]
});

export interface StoredJob {
  id?: string;
  key: string;
  event_id?: string;
  created_at?: Date;
  payload?: Record<string, unknown>;
}

export const jobs = defineEntity<StoredJob>({
  table: "jobs",
  columns: {
    key: {type: "text", notNull: true},
    event_id: {type: "text"},
    created_at: {type: "timestamptz", notNull: true, default: now()},
    payload: {type: "jsonb", notNull: true, default: {}}
  },
  indexes: [{columns: ["key"], unique: true}, {columns: ["event_id"]}, {columns: ["created_at"]}]
});
