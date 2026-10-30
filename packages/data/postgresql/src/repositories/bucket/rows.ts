import {Bucket} from "@spica-server/interface-bucket";

type Index = NonNullable<Bucket["indexes"]>[number];

const encodeIndex = (index: Index) => ({...index, definition: Object.entries(index.definition)});

const decodeIndex = (index: Index) => ({
  ...index,
  definition: Array.isArray(index.definition)
    ? Object.fromEntries(index.definition)
    : index.definition
});

// jsonb sorts object keys, which would reorder the columns of a compound index
export const encodeBucket = <T extends Partial<Bucket>>(bucket: T): T =>
  bucket.indexes ? {...bucket, indexes: bucket.indexes.map(encodeIndex) as Index[]} : bucket;

export const decodeBucket = <T extends Partial<Bucket> | null>(row: T): T =>
  row?.indexes ? {...row, indexes: row.indexes.map(decodeIndex)} : row;
