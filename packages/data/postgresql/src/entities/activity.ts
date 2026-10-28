import {defineEntity, now} from "@spica-server/data-postgresql-orm";
import {Activity} from "@spica-server/interface-activity";

export const activities = defineEntity<Activity>({
  table: "activities",
  idProperty: "_id",
  columns: {
    action: {type: "integer", notNull: true},
    identifier: {type: "uuid"},
    username: {type: "uuid"},
    resource: {type: "text[]", notNull: true, default: []},
    created_at: {type: "timestamptz", notNull: true, default: now()}
  },
  indexes: [{columns: ["created_at"]}, {columns: ["identifier"]}, {columns: ["username"]}]
});
