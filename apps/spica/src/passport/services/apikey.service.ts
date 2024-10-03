import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core";
import {Observable, of} from "rxjs";
import {ApiKey} from "../interfaces/apikey";

@Injectable({providedIn: "root"})
export class ApiKeyService {
  constructor(private http: HttpClient) {}

  getAll(
    limit: number,
    skip: number,
    sort: {[key: string]: number}
  ): Observable<IndexResult<ApiKey>> {
    return this.http.get<IndexResult<ApiKey>>("api:/passport/apikey", {
      params: {limit, skip, sort: JSON.stringify(sort)} as any
    });
  }

  get(id: string): Observable<ApiKey> {
    return this.http.get<ApiKey>(`api:/passport/apikey/${id}`);
  }

  insertOne(apiKey: ApiKey): Observable<ApiKey> {
    delete apiKey.policies;
    return this.http.post<ApiKey>(`api:/passport/apikey`, apiKey);
  }

  replaceOne(apiKey: ApiKey): Observable<ApiKey> {
    delete apiKey.policies;
    return this.http.put<ApiKey>(`api:/passport/apikey/${apiKey._id}`, apiKey);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`api:/passport/apikey/${id}`);
  }

  attachPolicy(policyId: string, apiKeyId: string): Observable<ApiKey> {
    return this.http.put<ApiKey>(`api:/passport/apikey/${apiKeyId}/policy/${policyId}`, {});
  }

  detachPolicy(policyId: string, apiKeyId: string): Observable<ApiKey> {
    return this.http.delete<ApiKey>(`api:/passport/apikey/${apiKeyId}/policy/${policyId}`);
  }
}

export class MockApiKeyService extends ApiKeyService {
  apiKeys: ApiKey[] = [];
  constructor() {
    super(undefined);
  }
  getAll(limit: number, skip: number, sort: {[k: string]: number}) {
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

  replaceOne(apiKey: ApiKey) {
    this.apiKeys = this.apiKeys.map(val => {
      if (val._id == apiKey._id) return apiKey;
    });
    return of(apiKey);
  }
  insertOne(apiKey: ApiKey) {
    const insertedApiKey = {
      ...apiKey,
      _id: this.apiKeys.length.toString()
    };
    this.apiKeys.push(insertedApiKey);
    return of(insertedApiKey);
  }

  delete(id: string) {
    const deletedItem = this.apiKeys.find(apiKey => apiKey._id === id);
    this.apiKeys = this.apiKeys.filter(apiKey => apiKey != deletedItem);
    return of(null);
  }

  attachPolicy(policyId: string, apiKeyId: string): Observable<ApiKey> {
    return of(
      this.apiKeys.find(apikey => {
        if (apikey._id == apiKeyId) {
          apikey.policies = new Array(...apikey.policies, ...[policyId]).filter(
            (policy, index, array) => {
              return array.indexOf(policy) === index;
            }
          );
          return apikey;
        }
      })
    );
  }

  detachPolicy(policyId: string, apiKeyId: string): Observable<ApiKey> {
    return of(
      this.apiKeys.find(apikey => {
        if (apikey._id == apiKeyId) {
          apikey.policies = new Array(...apikey.policies).filter(
            policy => [policyId].indexOf(policy) === -1
          );
          return apikey;
        }
      })
    );
  }
}
