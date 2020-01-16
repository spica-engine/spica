import {Injectable} from "@angular/core";
import {ApiKey} from "../interfaces/api-key";
import {HttpClient} from "@angular/common/http";
import {of, Observable} from "rxjs";
import {ObjectId} from "bson";
import {IndexResult} from "@spica-server/core";

@Injectable({providedIn: "root"})
export class ApiKeyService {
  apiKeys: ApiKey[] = [];
  constructor(private http: HttpClient) {
    this.apiKeys = JSON.parse(localStorage.getItem("apiKeys")) || [];
  }

  getApiKeys(limit?: number, skip?: number): Observable<IndexResult<ApiKey>> {
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

    //return this.http.get<ApiKey>(`api:/api-key`);
  }

  getApiKey(id: string) {
    return of(this.apiKeys.find(apiKey => apiKey._id == id));
    //return this.http.get<ApiKey>(`api:/api-key/${id}`);
  }

  updateApiKey(apiKey: ApiKey) {
    this.apiKeys.map(val => {
      if (val._id == apiKey._id) val = apiKey;
    });
    localStorage.setItem("apiKeys", JSON.stringify(this.apiKeys));
    return of(apiKey._id);
    //return this.http.put<ApiKey>(`api:/api-key/${apiKey._id}`, apiKey);
  }

  insertApiKey(apiKey: ApiKey) {
    const _id = new ObjectId().toHexString();
    this.apiKeys.push({...apiKey, _id: _id});
    localStorage.setItem("apiKeys", JSON.stringify(this.apiKeys));
    return of(_id);
    //return this.http.post<ApiKey>(`api:/api-key`, apiKey);
  }
}
