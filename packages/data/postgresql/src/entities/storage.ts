import {defineEntity} from "@spica-server/data-postgresql-orm";
import {Asset} from "@spica-server/interface-asset";
import {StorageObjectMeta} from "@spica-server/interface-storage";

export const storageObjects = defineEntity<StorageObjectMeta>({
  table: "storage_objects",
  idProperty: "_id",
  columns: {
    name: {type: "text", notNull: true},
    url: {type: "text"},
    created_at: {type: "timestamptz"},
    updated_at: {type: "timestamptz"},
    content: {embedded: {type: {type: "text"}, size: {type: "double precision"}}}
  },
  indexes: [{columns: ["name"], unique: true}]
});

export const assets = defineEntity<Asset>({
  table: "assets",
  idProperty: "_id",
  columns: {
    name: {type: "text"},
    description: {type: "text"},
    resources: {type: "jsonb", notNull: true, default: []},
    status: {type: "text"},
    configs: {type: "jsonb", notNull: true, default: []},
    url: {type: "text"},
    icon: {type: "text"}
  },
  indexes: [{columns: ["url"]}]
});
