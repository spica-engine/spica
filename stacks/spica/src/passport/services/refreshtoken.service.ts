import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core";
import {Observable, of} from "rxjs";
import {RefreshToken} from "../interfaces/refreshtoken";

@Injectable({providedIn: "root"})
export class RefreshTokenService {
  constructor(private http: HttpClient) {}

  getAll(
    limit?: number,
    skip?: number,
    sort?: object,
    filter?: object,
    paginate?: false
  ): Observable<RefreshToken[]>;
  getAll(
    limit?: number,
    skip?: number,
    sort?: object,
    filter?: object,
    paginate?: true
  ): Observable<IndexResult<RefreshToken>>;
  getAll(limit = 0, skip = 0, sort = {_id: -1}, filter = {}, paginate = false): Observable<unknown> {
    return this.http.get<any>("api:/passport/refreshtoken", {
      params: {
        limit: String(limit),
        skip: String(skip),
        sort: JSON.stringify(sort),
        filter: JSON.stringify(filter),
        paginate: String(paginate)
      }
    });
  }

  get(id: string): Observable<RefreshToken> {
    return this.http.get<RefreshToken>(`api:/passport/refreshtoken/${id}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`api:/passport/refreshtoken/${id}`);
  }
}