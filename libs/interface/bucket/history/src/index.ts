import {ObjectId} from "@spica-server/database";
import {Change} from "@spica-server/interface/core";

export interface History {
  _id?: string | ObjectId;
  bucket_id?: ObjectId;
  document_id?: ObjectId;
  title?: string;
  changes?: Change[];
  date?: any;
}
