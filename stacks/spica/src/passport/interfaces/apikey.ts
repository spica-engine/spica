import {Observable} from "rxjs";
import {IndexResult} from "@spica-server/core";

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
    active: true
  };
}

export abstract class ApiKeyService {
  get(id: string) {}
  getAll(limit?: number, skip?: number) {}
  update(apiKey: ApiKey) {}
  insert(apiKey: ApiKey) {}
}
