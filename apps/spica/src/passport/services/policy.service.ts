import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {Identity} from "../interfaces/identity";
import {Policy} from "../interfaces/policy";
import {Services} from "../interfaces/service";
import {IndexResult} from "@spica-client/core/interfaces";
import services from "./policy-services/services";

@Injectable({providedIn: "root"})
export class PolicyService {
  constructor(private http: HttpClient) {}

  find(limit = 0, skip = 0, filter = {}): Observable<IndexResult<Policy>> {
    return this.http.get<IndexResult<Policy>>(`api:/passport/policy`, {
      params: {limit: String(limit), skip: String(skip), filter: JSON.stringify(filter)}
    });
  }

  findOne(id: string): Observable<Policy> {
    return this.http.get<Policy>(`api:/passport/policy/${id}`);
  }

  getServices(): Services {
    return services;
  }

  attachPolicy(id: string, identifier: string): Observable<Identity> {
    return this.http.put<Identity>(`api:/passport/identity/${identifier}/policy/${id}`, {});
  }

  detachPolicy(id: string, identifier: string): Observable<Identity> {
    return this.http.delete<Identity>(`api:/passport/identity/${identifier}/policy/${id}`, {});
  }

  createPolicy(policy: Policy): Observable<Policy> {
    return this.http.post<Policy>(`api:/passport/policy`, policy);
  }

  deletePolicy(policyId: string): Observable<Policy> {
    return this.http.delete<Policy>(`api:/passport/policy/${policyId}`);
  }

  updatePolicy(policy: Policy): Observable<Policy> {
    const policyRequest = {
      ...policy,
      _id: undefined
    };
    return this.http.put<Policy>(`api:/passport/policy/${policy._id}`, policyRequest);
  }
}
