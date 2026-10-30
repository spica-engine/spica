import {Id} from "@spica-server/interface-data";
import {Bucket} from "./bucket.js";
import {StoredBucket} from "./repository.js";

/**
 * Owns the bucket definition write together with the structure of the bucket's data on the
 * running engine. `onSaved` runs as soon as the definition is saved, so observers can be told
 * about it even when the structure work that follows fails.
 */
export interface BucketSchemaManager {
  create(bucket: Bucket, onSaved: (saved: StoredBucket) => void): Promise<StoredBucket>;
  replace(
    id: Id,
    bucket: Bucket,
    onSaved: (saved: StoredBucket) => void
  ): Promise<StoredBucket | null>;
  drop(
    id: Id,
    onSaved: (dropped: StoredBucket) => void,
    onRelatedChanged?: (changed: StoredBucket) => void
  ): Promise<StoredBucket | null>;
}

export const BUCKET_SCHEMA_MANAGER = Symbol.for("BUCKET_SCHEMA_MANAGER");
