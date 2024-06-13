import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core";
import {Observable, of} from "rxjs";
import {BlacklistedToken} from "../interfaces/blacklistedtoken";

@Injectable({providedIn: "root"})
export class BlacklistedTokenService {
  constructor(private http: HttpClient) {}

  getAll(
    limit?: number,
    skip?: number,
    sort?: object,
    filter?: object,
    paginate?: false
  ): Observable<BlacklistedToken[]>;
  getAll(
    limit?: number,
    skip?: number,
    sort?: object,
    filter?: object,
    paginate?: true
  ): Observable<IndexResult<BlacklistedToken>>;
  getAll(limit = 0, skip = 0, sort = {_id: -1}, filter = {}, paginate = false): Observable<unknown> {
    return this.http.get<any>("api:/passport/blacklistedtoken", {
      params: {
        limit: String(limit),
        skip: String(skip),
        sort: JSON.stringify(sort),
        filter: JSON.stringify(filter),
        paginate: String(paginate)
      }
    });
  }

  get(id: string): Observable<BlacklistedToken> {
    return this.http.get<BlacklistedToken>(`api:/passport/blacklistedtoken/${id}`);
  }

  insertOne(blacklistedToken: BlacklistedToken): Observable<BlacklistedToken> {
    return this.http.post<BlacklistedToken>(`api:/passport/blacklistedtoken`, blacklistedToken);
  }

  replaceOne(blacklistedToken: BlacklistedToken): Observable<BlacklistedToken> {
    return this.http.put<BlacklistedToken>(`api:/passport/blacklistedtoken/${blacklistedToken._id}`, blacklistedToken);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`api:/passport/blacklistedtoken/${id}`);
  }
}