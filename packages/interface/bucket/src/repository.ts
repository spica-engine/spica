import {EntryStatus, Id, ProfilerQuery} from "@spica-server/interface-data";
import {Bucket, BucketDocument} from "./bucket.js";

export type StoredBucket = Bucket & {_id: Id};

export interface BucketRepository {
  findAll(): Promise<StoredBucket[]>;
  findById(id: Id): Promise<StoredBucket | null>;
  insert(bucket: Bucket): Promise<StoredBucket>;
  /**
   * Resolves to the replaced bucket, or null when it does not exist.
   */
  replaceById(id: Id, bucket: Bucket): Promise<StoredBucket | null>;
  /**
   * Resolves to the deleted bucket, or null when it does not exist.
   */
  deleteById(id: Id): Promise<StoredBucket | null>;
  /**
   * Removes schema properties given as dotted paths such as "properties.a.properties.b".
   */
  unsetProperties(id: Id, paths: string[]): Promise<number>;
  sumOfCountLimits(): Promise<number>;
  /**
   * Resolves to the buckets that have translatable properties, carrying only those properties.
   */
  findTranslatable(): Promise<StoredBucket[]>;
  /**
   * Resolves to the ids of buckets with a top-level relation property to the bucket.
   */
  findReferencing(bucketId: string): Promise<string[]>;
  status(): Promise<EntryStatus>;
}

export const BUCKET_REPOSITORY = Symbol.for("BUCKET_REPOSITORY");

/**
 * Paths are property path segments; core-differ's "/[0-9]*\/" segment stands for every array item.
 */
export interface BucketDataRepository {
  createStorage(bucket: Bucket): Promise<void>;
  dropStorage(bucketId: Id): Promise<void>;
  /**
   * Makes the bucket's indexes match its index definitions, rejecting with the combined errors.
   */
  syncIndexes(bucket: Bucket): Promise<void>;
  findById(bucket: Bucket, id: Id): Promise<BucketDocument | null>;
  /**
   * Removes the fields from every document; a schema differ positional segment matches every array element.
   */
  unsetFields(bucket: Bucket, paths: (string | number)[][]): Promise<void>;
  /**
   * Removes the reference to the document from the relation property at the dotted path.
   */
  clearRelation(
    bucket: Bucket,
    path: string,
    relationType: string,
    documentId: string
  ): Promise<void>;
  status(): Promise<EntryStatus>;
  statusOf(bucket: Bucket): Promise<EntryStatus>;
  profilerEntries(bucket: Bucket, query: ProfilerQuery): Promise<unknown[]>;
}

export const BUCKET_DATA_REPOSITORY = Symbol.for("BUCKET_DATA_REPOSITORY");
