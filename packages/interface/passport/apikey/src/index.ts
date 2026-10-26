import {Id} from "@spica-server/interface-data";

export interface ApikeyAsset {
  schema: ApiKey;
}

export interface ApiKey {
  _id?: Id;
  key?: string;
  name: string;
  description?: string;
  policies: Array<string>;
  active: boolean;
}
