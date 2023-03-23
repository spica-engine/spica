import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Injectable, Inject} from "@angular/core";
import {select, Store} from "@ngrx/store";
import {Observable} from "rxjs";
import {map, tap} from "rxjs/operators";
import {
  DeleteFunction,
  LoadFunctions,
  UpsertFunction,
  UpdateFunction
} from "../actions/function.actions";
import {Function, Information, Log, LogFilter, WEBSOCKET_INTERCEPTOR, Trigger} from "../interface";
import * as fromFunction from "../reducers/function.reducer";
import {PassportService} from "@spica-client/passport";
import {getWsObs, checkConnectivity} from "@spica-client/common";
import {examples} from "../statics/examples";

@Injectable({providedIn: "root"})
export class FunctionService {
  constructor(
    private http: HttpClient,
    private store: Store<fromFunction.State>,
    @Inject(WEBSOCKET_INTERCEPTOR) private wsInterceptor: string,
    private passport: PassportService
  ) {}

  getExample(trigger: Trigger) {
    if (trigger.type == "bucket") {
      if (!trigger.options.type) {
        return "Select the operation type to display example code.";
      }
      return examples.bucket[trigger.options.type];
    } else if (trigger.type == "database") {
      if (!trigger.options.type) {
        return "Select an operation type to display example code.";
      }
      return examples.database[trigger.options.type];
    } else if (examples[trigger.type]) {
      return examples[trigger.type];
    }
    return "Example code does not exist for this trigger.";
  }

  loadFunctions() {
    return this.http
      .get<Function[]>(`api:/function/`)
      .pipe(tap(functions => this.store.dispatch(new LoadFunctions({functions}))));
  }

  getFunctions(): Observable<Function[]> {
    return this.store.pipe(select(fromFunction.selectAll));
  }

  getFunction(id: string): Observable<Function> {
    return this.store.pipe(select(fromFunction.selectEntities)).pipe(map(entities => entities[id]));
  }

  checkRealtimeLogConnectivity() {
    const url = new URL(`${this.wsInterceptor}/function-logs`);
    url.searchParams.set("Authorization", this.passport.token);
    return checkConnectivity(url.toString());
  }

  getLogs(filter: LogFilter): Observable<Log[]> {
    const realtimeUrl = `${this.wsInterceptor}/function-logs`;
    const httpUrl = "api:/function-logs";
    let url = new URL(filter.realtime ? realtimeUrl : httpUrl);

    url = this.setFunctions(url, filter);
    url = this.setLevels(url, filter);
    url = this.setBeginEnd(url, filter);
    url = this.setSort(url, filter);

    if (filter.realtime) {
      url.searchParams.set("Authorization", this.passport.token);
      return getWsObs<Log>(url.toString(), filter.sort);
    }

    url.searchParams.set("skip", filter.skip.toString());
    url.searchParams.set("limit", filter.limit.toString());

    return this.http.get<Log[]>(url.toString());
  }

  private setFunctions(url: URL, filter: LogFilter) {
    if (filter.function.length > 0) {
      filter.function.forEach(fn => url.searchParams.append("functions", fn));
    }
    return url;
  }

  private setLevels(url: URL, filter: LogFilter) {
    if (filter.levels) {
      filter.levels.forEach(level => url.searchParams.append("levels", level.toString()));
    }
    return url;
  }

  private setBeginEnd(url: URL, filter: LogFilter) {
    if (filter.begin instanceof Date) {
      url.searchParams.set("begin", filter.begin.toISOString());
    }

    if (filter.end instanceof Date) {
      url.searchParams.set("end", filter.end.toISOString());
    }
    return url;
  }

  private setSort(url: URL, filter: LogFilter, def: {_id: 1 | -1} = {_id: -1}) {
    if (!filter.sort) {
      filter.sort = def;
    }

    url.searchParams.set("sort", JSON.stringify(filter.sort));

    return url;
  }

  clearLogs(id: string, filter: LogFilter) {
    let url = new URL(`api:/function-logs/${id}`);
    url = this.setBeginEnd(url, filter);
    url = this.setLevels(url, filter);
    return this.http.delete<any[]>(url.toString());
  }

  getIndex(id): Observable<any> {
    return this.http.get<any>(`api:/function/${id}/index`);
  }

  updateIndex(fnId: string, index: string): Observable<void> {
    return this.http.post<any>(`api:/function/${fnId}/index`, {index});
  }

  getDeclarations(): Observable<{declarations: string}> {
    return this.http.get<{declarations: string}>(`api:/function/declaration`);
  }

  information(scope?: string): Observable<Information> {
    return this.http.get<Information>(`api:/function/information`);
  }

  insertOne(fn: Function): Observable<Function> {
    return this.http
      .post<Function>(`api:/function`, fn)
      .pipe(tap(fn => this.store.dispatch(new UpsertFunction({function: fn}))));
  }

  replaceOne(fn: Function): Observable<Function> {
    return this.http
      .put<Function>(`api:/function/${fn._id}`, fn)
      .pipe(
        tap(fn => this.store.dispatch(new UpdateFunction({function: {id: fn._id, changes: fn}})))
      );
  }

  updateOne(id: string, update: {[key: string]: any}) {
    return this.http
      .patch(`api:/function/${id}`, update, {
        headers: new HttpHeaders().set("Content-Type", "application/merge-patch+json")
      })
      .pipe(
        tap(_ => this.store.dispatch(new UpdateFunction({function: {id: id, changes: update}})))
      );
  }

  delete(id: string): Observable<any> {
    return this.http
      .delete(`api:/function/${id}`)
      .pipe(tap(() => this.store.dispatch(new DeleteFunction({id}))));
  }
}
