import {defineEntity} from "@spica-server/data-postgresql-orm";
import {BaseConfig} from "@spica-server/interface-config";
import {Id} from "@spica-server/interface-data";

export const configs = defineEntity<BaseConfig & {_id?: Id}>({
  table: "configs",
  idProperty: "_id",
  columns: {
    module: {type: "text", notNull: true},
    options: {type: "jsonb"}
  },
  indexes: [{columns: ["module"], unique: true}]
});
