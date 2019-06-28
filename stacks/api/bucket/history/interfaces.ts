import {ObjectId} from "@spica-server/database";
import {patch_obj} from "diff-match-patch";

export interface BucketChange {
  diff?: Array<[number, string]>;
  patch?: patch_obj[];
  kind: string;
  path?: string[];
}

export interface BucketHistory {
  _id?: string | ObjectId;
  bucket_id?: ObjectId;
  bucket_data_id?: ObjectId;
  title?: string;
  changes?: BucketChange[];
  date?: any;
}
