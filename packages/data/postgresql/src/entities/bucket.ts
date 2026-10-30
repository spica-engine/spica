import {defineEntity, now} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {History} from "@spica-server/interface-bucket-history";

export const buckets = defineEntity<Bucket>({
  table: "buckets",
  idProperty: "_id",
  columns: {
    type: {type: "text"},
    category: {type: "text"},
    title: {type: "text"},
    icon: {type: "text"},
    description: {type: "text"},
    primary: {type: "text", column: "primary_key"},
    history: {type: "boolean"},
    readOnly: {type: "boolean"},
    properties: {type: "jsonb"},
    order: {type: "double precision", column: "display_order"},
    required: {type: "text[]"},
    acl: {embedded: {read: {type: "text"}, write: {type: "text"}}},
    documentSettings: {
      embedded: {countLimit: {type: "double precision"}, limitExceedBehaviour: {type: "text"}}
    },
    indexes: {type: "jsonb"}
  }
});

export const histories = defineEntity<History & {created_at?: Date}>({
  table: "histories",
  idProperty: "_id",
  columns: {
    bucket_id: {type: "uuid", notNull: true},
    document_id: {type: "text", notNull: true},
    changes: {type: "jsonb", notNull: true, default: []},
    created_at: {type: "timestamptz", notNull: true, default: now()}
  },
  indexes: [{columns: ["bucket_id", "document_id"]}, {columns: ["document_id"]}]
});
