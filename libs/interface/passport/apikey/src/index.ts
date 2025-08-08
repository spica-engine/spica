import {ObjectId} from "../../../../database";

export interface ApikeyAsset {
  schema: ApiKey;
}

export interface ApiKey {
  _id?: ObjectId;
  key?: string;
  name: string;
  description?: string;
  policies: Array<string>;
  active: boolean;
}
