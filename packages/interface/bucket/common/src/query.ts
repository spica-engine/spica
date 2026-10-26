import {Id, Page} from "@spica-server/interface-data";
import {Bucket, BucketPreferences} from "@spica-server/interface-bucket";
import {Locale} from "./locale.js";

export interface BucketReadSpec {
  documentId?: Id;
  resourceFilter?: object;
  /**
   * A revived JSON filter or an ACL expression string, as clients send them today.
   */
  filter?: object | string;
  language?: string;
  localize?: boolean;
  relationPaths?: string[][];
  projectMap?: string[][];
  sort?: object;
  skip?: number;
  limit?: number;
  applyAcl?: boolean;
  user?: unknown;
}

export interface BucketReadContext {
  resolveSchema: (id: string | Id) => Promise<Bucket> | Bucket;
  preferences: () => Promise<BucketPreferences>;
  hashSecret?: string;
  encryptionSecret?: string;
}

export interface BucketReadResult<R> {
  result: R;
  locale?: Locale;
}

export interface BucketQueryFacade {
  find<T>(
    bucket: Bucket,
    spec: BucketReadSpec,
    context: BucketReadContext
  ): Promise<BucketReadResult<T[]>>;
  findOne<T>(
    bucket: Bucket,
    spec: BucketReadSpec,
    context: BucketReadContext
  ): Promise<BucketReadResult<T | undefined>>;
  paginate<T>(
    bucket: Bucket,
    spec: BucketReadSpec,
    context: BucketReadContext
  ): Promise<BucketReadResult<Page<T>>>;
}

export const BUCKET_QUERY = Symbol.for("SPICA_DATA_BUCKET_QUERY");
