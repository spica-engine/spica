import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core/interfaces";
import {Observable, of} from "rxjs";

import {Webhook, WebhookLog, WebhookLogFilter} from "./interface";

@Injectable({providedIn: "root"})
export class WebhookService {
  constructor(private http: HttpClient) {}

  private resetTimezoneOffset(date: Date) {
    return new Date(date.setMinutes(date.getMinutes() - date.getTimezoneOffset()));
  }

  get(id: string): Observable<Webhook> {
    return this.http.get<Webhook>(`api:/webhook/${id}`);
  }

  getAll(limit?: any, skip?: any): Observable<IndexResult<Webhook>> {
    return this.http.get<IndexResult<Webhook>>(`api:/webhook`, {
      params: {limit: limit, skip: skip}
    });
  }

  add(payload: Webhook): Observable<Webhook> {
    return this.http.post<Webhook>(`api:/webhook`, payload);
  }

  update(payload: Webhook): Observable<Webhook> {
    const path = `api:/webhook/${payload._id}`;
    delete payload._id;
    return this.http.put<Webhook>(path, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`api:/webhook/${id}`);
  }

  getCollections(): Observable<string[]> {
    return this.http.get<string[]>(`api:/webhook/collections`);
  }

  getLogs(filter: WebhookLogFilter): Observable<WebhookLog[]> {
    let params: any = {};

    if (filter.date.begin && filter.date.end) {
      params.begin = this.resetTimezoneOffset(new Date(filter.date.begin)).toISOString();
      params.end = this.resetTimezoneOffset(new Date(filter.date.end)).toISOString();
    }

    params.webhook = filter.webhooks;

    params.status = filter.statusCodes;

    params.limit = filter.limit;

    params.skip = filter.skip;

    return this.http.get<WebhookLog[]>(`api:/webhook/logs`, {params});
  }

  clearLogs(logIds: string[]) {
    return this.http.request("delete", "api:/webhook/logs", {
      body: logIds
    });
  }
}

export class MockWebkhookService extends WebhookService {
  webhooks: Webhook[];
  collections: string[];

  constructor() {
    super(undefined);
    this.webhooks = [];
    this.collections = ["identity", "bucket"];
  }

  get(id: string): Observable<Webhook> {
    return of(this.webhooks.find(webhook => webhook._id == id));
  }

  getAll(limit?: any, skip?: any): Observable<IndexResult<Webhook>> {
    let filteredWebhooks: Webhook[] = [];

    if (skip) filteredWebhooks = this.webhooks.filter((_, index) => index >= skip);
    if (limit)
      filteredWebhooks = skip
        ? filteredWebhooks.filter((_, index) => index < limit)
        : this.webhooks.filter((_, index) => index < limit);

    return of({meta: {total: this.webhooks.length}, data: filteredWebhooks} as IndexResult<
      Webhook
    >);
  }

  add(payload: Webhook): Observable<Webhook> {
    this.webhooks.push({...payload, _id: this.webhooks.length.toString()});
    return of(payload);
  }

  update(payload: Webhook): Observable<Webhook> {
    this.webhooks = this.webhooks.map(webhook => (webhook._id == payload._id ? payload : webhook));
    return of(payload);
  }

  delete(id: string): Observable<void> {
    this.webhooks = this.webhooks.filter(webhook => webhook._id != id);
    return of();
  }

  getCollections(): Observable<string[]> {
    return of(this.collections);
  }
}
