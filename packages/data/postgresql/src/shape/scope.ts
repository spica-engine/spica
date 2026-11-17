import {Bucket} from "@spica-server/interface-bucket";
import {BucketMetadata, TableMetadata} from "../schema/index.js";
import {Row, RowSet} from "./row-set.js";

export interface BucketDescription {
  definition: Bucket;
  metadata: BucketMetadata;
}

export interface ShapeEnvironment {
  describe(bucketId: string): BucketDescription;
  locale?: {best: string; fallback: string};
}

export interface Scope {
  description: BucketDescription;
  rowSet: RowSet;
  table: TableMetadata;
  row: Row;
}
