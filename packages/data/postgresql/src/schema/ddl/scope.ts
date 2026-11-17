import {BucketMetadata, TableMetadata} from "../metadata/index.js";
import {KeyChange} from "./key-change.js";

export interface TablePair {
  before: TableMetadata;
  after: TableMetadata;
}

export interface UpdateScope {
  previous: BucketMetadata;
  next: BucketMetadata;
  keyChange?: KeyChange;
  ownKey?: KeyChange;
}
