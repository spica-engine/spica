import {defineEntity} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";

export interface StoredPreference {
  _id?: Id;
  scope: string;
  value?: Record<string, unknown>;
}

export const preferences = defineEntity<StoredPreference>({
  table: "preferences",
  idProperty: "_id",
  columns: {
    scope: {type: "text", notNull: true},
    value: {type: "jsonb", notNull: true, default: {}}
  },
  indexes: [{columns: ["scope"], unique: true}]
});
