import {
  BucketDescription,
  BucketShaper,
  describeBucket,
  mainTableName,
  primaryKeyMetadata,
  RowSet
} from "@spica-server/data-postgresql";

export const uuid = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;

export const definition = (properties: object, extra: object = {}) =>
  ({
    title: "bucket",
    primary: "id",
    acl: {read: "", write: ""},
    properties: {id: {type: "uuid", options: {generated: true}}, ...properties},
    ...extra
  }) as any;

export function describeAll(buckets: Record<string, any>) {
  const targets = (id: string) =>
    buckets[id] && {table: mainTableName(id), primaryKey: primaryKeyMetadata(buckets[id])};
  const descriptions = new Map<string, BucketDescription>(
    Object.entries(buckets).map(([id, bucket]) => [
      id,
      {definition: bucket, metadata: describeBucket(id, bucket, targets)}
    ])
  );
  return (id: string) => descriptions.get(id);
}

export function shapeWith(
  buckets: Record<string, any>,
  rootId: string,
  rowSet: RowSet,
  locale?: {best: string; fallback: string}
) {
  const describe = describeAll(buckets);
  return JSON.parse(
    JSON.stringify(new BucketShaper().shape(rowSet, describe(rootId), {describe, locale}))
  );
}
