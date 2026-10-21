import {Id} from "@spica-server/interface-data";
import {Change} from "@spica-server/interface-core";

export interface History {
  _id?: string | Id;
  bucket_id?: Id;
  document_id?: Id;
  title?: string;
  changes?: Change[];
  date?: any;
}
