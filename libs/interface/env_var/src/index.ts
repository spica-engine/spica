import {ObjectId} from "../../../database";
export interface EnvVar {
  _id: ObjectId;
  key: string;
  value: string;
}
