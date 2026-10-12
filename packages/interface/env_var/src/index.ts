import {ObjectId} from "bson";
export interface EnvVar {
  _id?: ObjectId;
  key: string;
  value: string;
  updated_at?: Date;
}
