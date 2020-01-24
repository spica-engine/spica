export interface ApiKey {
  _id?: string;
  key?: string;
  name: string;
  description?: string;
  policies?: Array<string>;
  active: boolean;
}

export function emptyApiKey(): ApiKey {
  return {
    name: undefined,
    active: true,
    policies: []
  };
}
