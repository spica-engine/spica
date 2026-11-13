import {defineEntity, now} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {Id} from "@spica-server/interface-data";
import {History} from "@spica-server/interface-bucket-history";

type Index = NonNullable<Bucket["indexes"]>[number];

// jsonb sorts object keys, which would reorder the columns of a compound index
const indexesCodec = {
  encode: (indexes: Index[]) =>
    indexes.map(index => ({...index, definition: Object.entries(index.definition)})),
  decode: (indexes: Index[]) =>
    indexes.map(index => ({
      ...index,
      definition: Array.isArray(index.definition)
        ? Object.fromEntries(index.definition)
        : index.definition
    }))
};

export const buckets = defineEntity<Bucket & {id?: Id}>({
  table: "buckets",
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
    indexes: {type: "jsonb", codec: indexesCodec}
  }
});

export const histories = defineEntity<History & {created_at?: Date; id?: Id}>({
  table: "histories",
  columns: {
    bucket_id: {type: "uuid", notNull: true},
    document_id: {type: "text", notNull: true},
    changes: {type: "jsonb", notNull: true, default: []},
    created_at: {type: "timestamptz", notNull: true, default: now()}
  },
  indexes: [{columns: ["bucket_id", "document_id"]}, {columns: ["document_id"]}]
});
