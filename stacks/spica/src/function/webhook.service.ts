import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core/interfaces";
import {Observable} from "rxjs";

import {Webhook, Trigger} from "./interface";

@Injectable({providedIn: "root"})
export class WebhookService {
  constructor(private http: HttpClient) {}

  get(id: string): Observable<Webhook> {
    return this.http.get<Webhook>(`api:/webhook/${id}`);
  }

  getAll(limit?: any, skip?: any): Observable<IndexResult<Webhook>> {
    return this.http.get<IndexResult<Webhook>>(`api:/webhook`, {
      params: {limit: limit, skip: skip}
    });
  }

  add(payload: Webhook): Observable<Webhook> {
    return this.http.post<Webhook>(`api:/webhook/add`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`api:/webhook/${id}`);
  }

  getTriggers(): Observable<Trigger> {
    return this.http.get<Trigger>(`api:/function/trigger`);
  }
}
