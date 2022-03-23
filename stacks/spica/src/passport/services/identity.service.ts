import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core/interfaces";
import {Observable} from "rxjs";
import {Identity, TwoFactorAuthSchema} from "../interfaces/identity";
import {PredefinedDefault} from "../interfaces/predefined-default";

@Injectable({
  providedIn: "root"
})
export class IdentityService {
  constructor(private http: HttpClient) {}

  find(
    limit?: number,
    skip?: number,
    sort?: object,
    filter?: object,
    paginate?: false
  ): Observable<Identity[]>;
  find(
    limit?: number,
    skip?: number,
    sort?: object,
    filter?: object,
    paginate?: true
  ): Observable<IndexResult<Identity>>;
  find(limit = 0, skip = 0, sort = {_id: -1}, filter = {}, paginate = false): Observable<unknown> {
    return this.http.get<any>("api:/passport/identity", {
      params: {
        limit: String(limit),
        skip: String(skip),
        sort: JSON.stringify(sort),
        filter: JSON.stringify(filter),
        paginate: String(paginate)
      }
    });
  }

  findOne(id: string): Observable<Identity> {
    return this.http.get<Identity>(`api:/passport/identity/${id}`);
  }

  insertOne(identity: Identity): Observable<Identity> {
    return this.http.post<Identity>(`api:/passport/identity`, identity);
  }

  updateOne(identity: Identity): Observable<Identity> {
    const identityRequest = {
      ...identity,
      _id: undefined
    };
    return this.http.put<Identity>(`api:/passport/identity/${identity._id}`, identityRequest);
  }

  deleteOne(id: string): Observable<void> {
    return this.http.delete<void>(`api:/passport/identity/${id}`);
  }

  getPredefinedDefaults(): Observable<PredefinedDefault[]> {
    return this.http.get<PredefinedDefault[]>(`api:/passport/identity/predefs`);
  }

  getTwoFactorAuthSchemas(): Observable<TwoFactorAuthSchema[]> {
    return this.http.get<any>("api:/passport/identity/factors");
  }
}
