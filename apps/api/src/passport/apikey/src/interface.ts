import {ObjectId} from "@spica-server/database";

export interface ApiKey {
  _id?: ObjectId;
  key?: string;
  name: string;
  description?: string;
  policies: Array<string>;
  active: boolean;
}
