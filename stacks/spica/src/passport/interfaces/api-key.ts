import {Policy} from "./policy";
import {Observable} from "rxjs";
import {IndexResult} from "@spica-server/core";
import {HttpClient} from "@angular/common/http";

export interface ApiKey {
  _id?: string;
  key?: string;
  name: string;
  description?: string;
  policies?: string[];
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
