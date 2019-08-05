import {ObjectId} from "@spica-server/database";
import {Change} from "./differ";

export interface History {
  _id?: string | ObjectId;
  bucket_id?: ObjectId;
  document_id?: ObjectId;
  title?: string;
  changes?: Change[];
  date?: any;
}

export interface BucketDocument {
  _id?: ObjectId;
  [key: string]: any | undefined;
}
