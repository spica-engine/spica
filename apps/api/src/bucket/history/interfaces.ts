import {ObjectId} from "@spica/database";
import {Change} from "@spica/core";

export interface History {
  _id?: string | ObjectId;
  bucket_id?: ObjectId;
  document_id?: ObjectId;
  title?: string;
  changes?: Change[];
  date?: any;
}
