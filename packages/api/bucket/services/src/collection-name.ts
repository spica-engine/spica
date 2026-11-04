import {Id} from "@spica-server/interface-data";

export function getBucketDataCollection(bucketId: string | Id): string {
  return `bucket_${bucketId}`;
}
