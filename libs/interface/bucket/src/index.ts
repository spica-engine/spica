import {Bucket} from "@spica-server/interface/bucket/services";

export interface BucketAsset {
  schema: Bucket;
}

export interface BucketOptions {
  hooks: boolean;
  history: boolean;
  realtime: boolean;
  cache: boolean;
  cacheTtl?: number;
  bucketDataLimit?: number;
  graphql: boolean;
}
