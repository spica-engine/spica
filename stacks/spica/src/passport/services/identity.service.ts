import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core/interfaces";
import {Observable} from "rxjs";
import {Identity} from "../interfaces/identity";
import {PredefinedDefault} from "../interfaces/predefined-default";

@Injectable({
  providedIn: "root"
})
export class IdentityService {
  constructor(private http: HttpClient) {}

  find(limit: number, skip: number): Observable<IndexResult<Identity>> {
    return this.http.get<IndexResult<Identity>>("api:/passport/identity", {
      params: {limit: String(limit), skip: String(skip)}
    });
  }

  findOne(id: string): Observable<Identity> {
    return this.http.get<Identity>(`api:/passport/identity/${id}`);
  }

  insertOne(identity: Identity): Observable<Identity> {
    return this.http.post<Identity>(`api:/passport/identity/create`, identity);
  }

  updateOne(identity: Identity): Observable<void> {
    const identityRequest = {
      ...identity,
      _id: undefined
    };
    return this.http.post<void>(`api:/passport/identity/${identity._id}`, identityRequest);
  }

  deleteOne(id: string): Observable<void> {
    return this.http.delete<void>(`api:/passport/identity/${id}`);
  }

  getPredefinedDefaults(): Observable<PredefinedDefault[]> {
    return this.http.get<PredefinedDefault[]>(`api:/passport/identity/predefs`);
  }
}
