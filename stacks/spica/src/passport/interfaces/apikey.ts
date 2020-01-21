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

export interface ApiKeyService {
  get(id: string): Observable<ApiKey>;
  getAll(limit?: number, skip?: number): Observable<IndexResult<ApiKey>>;
  update(apiKey: ApiKey): Observable<ApiKey>;
  insert(apiKey: ApiKey): Observable<ApiKey>;
}
