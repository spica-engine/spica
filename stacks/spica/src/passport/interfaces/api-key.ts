export interface ApiKey {
  _id?: string;
  key: string;
  name: string;
  description: string;
}

export function emptyApiKey(): ApiKey {
  return {
    key: undefined,
    name: undefined,
    description: undefined
  };
}
