import {Policy} from "./policy";

export interface ApiKey {
  _id?: string;
  name: string;
  description?: string;
  policies: Policy[];
  active: boolean;
}

export function emptyApiKey(): ApiKey {
  return {
    _id: undefined,
    name: undefined,
    description: undefined,
    policies: [],
    active: true
  };
}
