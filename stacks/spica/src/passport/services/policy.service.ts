import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {Identity} from "../interfaces/identity";
import {Policy} from "../interfaces/policy";
import {Service} from "../interfaces/service";
import {IndexResult} from "@spica-client/core/interfaces";

@Injectable({providedIn: "root"})
export class PolicyService {
  constructor(private http: HttpClient) {}

  find(limit?: number, skip?: number): Observable<IndexResult<Policy>> {
    return this.http.get<IndexResult<Policy>>(`api:/passport/policy`, {
      params: {limit: String(limit), skip: String(skip)}
    });
  }

  findOne(id: string): Observable<Policy> {
    return this.http.get<Policy>(`api:/passport/policy/${id}`);
  }

  getServices(): Observable<Service[]> {
    return this.http.get<Service[]>(`api:/passport/policy/services`);
  }

  attachPolicy(id: string, identifier: string): Observable<Identity> {
    return this.http.put<Identity>(`api:/passport/identity/${identifier}/attach-policy`, [id]);
  }

  detachPolicy(id: string, identifier: string): Observable<Identity> {
    return this.http.put<Identity>(`api:/passport/identity/${identifier}/detach-policy`, [id]);
  }

  createPolicy(policy: Policy): Observable<Policy> {
    return this.http.post<Policy>(`api:/passport/policy/create`, policy);
  }

  deletePolicy(policyId: string): Observable<Policy> {
    return this.http.delete<Policy>(`api:/passport/policy/${policyId}`);
  }

  updatePolicy(policy: Policy): Observable<Policy> {
    const policyRequest = {
      ...policy,
      _id: undefined
    };
    return this.http.post<Policy>(`api:/passport/policy/${policy._id}`, policyRequest);
  }
}
