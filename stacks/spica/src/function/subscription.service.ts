import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core/interfaces";
import {Observable} from "rxjs";

import {Subscription, Trigger} from "./interface";

@Injectable({providedIn: "root"})
export class SubscriptionService {
  constructor(private http: HttpClient) {}

  get(id: string): Observable<Subscription> {
    return this.http.get<Subscription>(`api:/subscription/${id}`);
  }

  getAll(limit?: any, skip?: any): Observable<IndexResult<Subscription>> {
    return this.http.get<IndexResult<Subscription>>(`api:/subscription`, {
      params: {limit: limit, skip: skip}
    });
  }

  add(payload: Subscription): Observable<Subscription> {
    return this.http.post<Subscription>(`api:/subscription/add`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`api:/subscription/${id}`);
  }

  getTriggers(): Observable<Trigger> {
    return this.http.get<Trigger>(`api:/function/trigger`);
  }
}
