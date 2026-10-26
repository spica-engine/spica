import {Id} from "@spica-server/interface-data";
export interface EnvVar {
  _id?: Id;
  key: string;
  value: string;
  updated_at?: Date;
}
