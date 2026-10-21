import {Id} from "@spica-server/interface-data";
import {Bucket, BucketDocument} from "@spica-server/interface-bucket";

export type ReturnedDocument = "before" | "after";

export interface BucketWriteOptions {
  applyAcl?: boolean;
  user?: unknown;
}

export interface BucketWriteContext {
  resolveSchema: (id: string | Id) => Promise<Bucket> | Bucket;
  hashSecret?: string;
  encryptionSecret?: string;
}

export interface BucketInsertContext extends BucketWriteContext {
  /**
   * Deletes the oldest document when the bucket evicts documents to stay within its count limit,
   * so callers keep running their own delete side effects.
   */
  deleteOne: (documentId: Id) => Promise<void>;
}

export interface BucketWriteFacade {
  insert(
    bucket: Bucket,
    document: BucketDocument,
    options: BucketWriteOptions,
    context: BucketInsertContext
  ): Promise<BucketDocument>;
  replace(
    bucket: Bucket,
    document: BucketDocument,
    options: BucketWriteOptions & {returnDocument?: ReturnedDocument},
    context: BucketWriteContext
  ): Promise<BucketDocument | null>;
  patch(
    bucket: Bucket,
    document: BucketDocument,
    patch: object,
    options: BucketWriteOptions & {returnDocument?: ReturnedDocument},
    context: BucketWriteContext
  ): Promise<BucketDocument | null>;
  delete(
    bucket: Bucket,
    documentId: string | Id,
    options: BucketWriteOptions,
    context: BucketWriteContext
  ): Promise<BucketDocument | undefined>;
}

export const BUCKET_WRITE = Symbol.for("SPICA_DATA_BUCKET_WRITE");
