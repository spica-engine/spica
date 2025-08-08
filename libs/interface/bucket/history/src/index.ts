import {ObjectId} from "../../../../database";
import {Change} from "../../../core";

export interface History {
  _id?: string | ObjectId;
  bucket_id?: ObjectId;
  document_id?: ObjectId;
  title?: string;
  changes?: Change[];
  date?: any;
}
