
export interface ApikeyAsset {
  schema: ApiKey;
}

export interface ApiKey {
  key?: string;
  name: string;
  description?: string;
  policies: Array<string>;
  active: boolean;
}
