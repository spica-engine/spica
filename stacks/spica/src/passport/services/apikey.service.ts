import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-server/core";
import {Observable, of} from "rxjs";
import {ApiKey} from "../interfaces/apikey";

@Injectable({providedIn: "root"})
export class ApiKeyService {
  constructor(private http: HttpClient) {}

  getAll(limit?: number, skip?: number): Observable<IndexResult<ApiKey>> {
    let params = {};
    if (limit) params = {...params, limit: limit};
    if (skip) params = {...params, skip: skip};
    return this.http.get<IndexResult<ApiKey>>("api:/passport/apikey", {
      params: params
    });
  }

  get(id: string): Observable<ApiKey> {
    return this.http.get<ApiKey>(`api:/passport/apikey/${id}`);
  }

  insert(apiKey: ApiKey): Observable<ApiKey> {
    return this.http.post<ApiKey>(`api:/passport/apikey`, apiKey);
  }

  update(apiKey: ApiKey): Observable<ApiKey> {
    return this.http.post<ApiKey>(`api:/passport/apikey/${apiKey._id}`, apiKey);
  }

  attachPolicy(policyId: string, apiKey: ApiKey): Observable<ApiKey> {
    return this.http.put<ApiKey>(`api:/passport/apikey/${apiKey._id}/attach-policy`, [policyId]);
  }

  detachPolicy(policyId: string, apiKey: ApiKey): Observable<ApiKey> {
    return this.http.put<ApiKey>(`api:/passport/apikey/${apiKey._id}/detach-policy`, [policyId]);
  }
}

export class MockApiKeyService extends ApiKeyService {
  apiKeys: ApiKey[] = [];
  constructor() {
    super(undefined);
  }
  getAll(limit?: number, skip?: number) {
    if (limit || skip) {
      let copyApiKeys = JSON.parse(JSON.stringify(this.apiKeys));
      return of({
        meta: {total: this.apiKeys.length},
        data: copyApiKeys.slice(
          skip || 0,
          limit + skip <= copyApiKeys.length ? limit + skip : copyApiKeys.length
        )
      } as IndexResult<ApiKey>);
    } else {
      return of({meta: {total: this.apiKeys.length}, data: this.apiKeys} as IndexResult<ApiKey>);
    }
  }
  get(id: string) {
    return of(this.apiKeys.find(apiKey => apiKey._id == id));
  }
  update(apiKey: ApiKey) {
    this.apiKeys = this.apiKeys.map(val => {
      if (val._id == apiKey._id) return apiKey;
    });
    return of(apiKey);
  }
  insert(apiKey: ApiKey) {
    const insertedApiKey = {
      ...apiKey,
      _id: this.apiKeys.length.toString()
    };
    this.apiKeys.push(insertedApiKey);
    return of(insertedApiKey);
  }
}
