import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {select, Store} from "@ngrx/store";
import {IndexResult} from "@spica-client/core/interfaces";
import {Observable} from "rxjs";
import {switchMap, tap} from "rxjs/operators";
import {
  DeleteWebhook,
  LoadWebhooks,
  UpdateWebhook,
  UpsertWebhook
} from "../actions/webhook.actions";
import {Webhook, WebhookLog, WebhookLogFilter} from "../interface";
import * as fromWebhook from "../reducers/webhook.reducer";

export interface WebhookResult {
  meta: {};
  data: Webhook[];
}

@Injectable({providedIn: "root"})
export class WebhookService {
  constructor(private http: HttpClient, private store: Store<fromWebhook.State>) {}

  private resetTimezoneOffset(date: Date) {
    return new Date(date.setMinutes(date.getMinutes() - date.getTimezoneOffset()));
  }

  loadWebhooks() {
    return this.http
      .get<WebhookResult>(`api:/webhook/`)
      .pipe(
        tap((webhooks: WebhookResult) =>
          this.store.dispatch(new LoadWebhooks({webhooks: webhooks.data}))
        )
      );
  }
  getWebhooks(): Observable<Webhook[]> {
    return this.store.pipe(select(fromWebhook.selectAll));
  }

  get(id: string): Observable<Webhook> {
    return this.http.get<Webhook>(`api:/webhook/${id}`);
  }

  getAll(limit: any, skip: any, sort: {[k: string]: number}): Observable<IndexResult<Webhook>> {
    return this.http.get<IndexResult<Webhook>>(`api:/webhook`, {
      params: {limit: limit, skip: skip, sort: JSON.stringify(sort)}
    });
  }

  add(payload: Webhook): Observable<Webhook> {
    return this.http
      .post<Webhook>(`api:/webhook`, payload)
      .pipe(tap(wb => this.store.dispatch(new UpsertWebhook({webhook: wb}))));
  }

  update(payload: Webhook): Observable<Webhook> {
    const path = `api:/webhook/${payload._id}`;
    delete payload._id;
    return this.http
      .put<Webhook>(path, payload)
      .pipe(
        tap(wb => this.store.dispatch(new UpdateWebhook({webhook: {id: wb._id, changes: wb}})))
      );
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<void>(`api:/webhook/${id}`)
      .pipe(tap(() => this.store.dispatch(new DeleteWebhook({id}))));
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

    params.succeed = filter.succeed;

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
