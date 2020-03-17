import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {select, Store} from "@ngrx/store";
import {Observable} from "rxjs";
import {map, tap} from "rxjs/operators";
import {
  DeleteFunction,
  LoadFunctions,
  UpsertFunction,
  UpdateFunction
} from "./actions/function.actions";
import {Function, Information, Log, LogFilter} from "./interface";
import * as fromFunction from "./reducers/function.reducer";

@Injectable({providedIn: "root"})
export class FunctionService {
  constructor(private http: HttpClient, private store: Store<fromFunction.State>) {}

  private resetTimezoneOffset(date: Date) {
    return new Date(date.setMinutes(date.getMinutes() - date.getTimezoneOffset()));
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

  getLogs(filter: LogFilter): Observable<Log[]> {
    const serializedFilter: {[P in keyof LogFilter]?: string | string[]} = {
      functions: filter.functions
    };

    if (filter.begin instanceof Date) {
      serializedFilter.begin = this.resetTimezoneOffset(filter.begin).toISOString();
    }

    if (filter.end instanceof Date) {
      serializedFilter.end = this.resetTimezoneOffset(filter.end).toISOString();
    }
    return this.http.get<any[]>(`api:/function/logs`, {params: serializedFilter});
  }

  clearLogs(id: string) {
    return this.http.delete<any[]>(`api:/function/${id}/logs`);
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

  delete(id: string): Observable<any> {
    return this.http
      .delete(`api:/function/${id}`)
      .pipe(tap(() => this.store.dispatch(new DeleteFunction({id}))));
  }
}
