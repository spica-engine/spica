import {ObjectId} from "@spica-server/database";
export interface EnvVar {
  _id: ObjectId;
  key: string;
  value: string;
}
