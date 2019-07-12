import {HttpClient, HttpRequest, HttpHeaders} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {select, Store} from "@ngrx/store";
import {Observable, from} from "rxjs";
import {map, tap, flatMap} from "rxjs/operators";
import * as BSON from "bson";
import {
  AddFunction,
  DeleteFunction,
  LoadFunctions,
  UpsertFunction
} from "./actions/function.actions";
import {Function, LogFilter} from "./interface";
import * as fromFunction from "./reducers/function.reducer";

@Injectable({providedIn: "root"})
export class FunctionService {
  constructor(private http: HttpClient, private store: Store<fromFunction.State>) {}

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

  getLogs(id: string, filter: LogFilter): Observable<any[]> {
    return this.http.get<any[]>(`api:/function/${id}/logs`, {params: filter as any});
  }

  clearLogs(id: string) {
    return this.http.delete<any[]>(`api:/function/${id}/logs`);
  }

  getIndex(id): Observable<any> {
    return this.http.get<any>(`api:/function/${id}/index`);
  }

  updateIndex(fnId: string, index: string): Observable<any> {
    return this.http.post<any>(`api:/function/${fnId}/index`, {index});
  }

  getDeclarations(): Observable<{declarations: string}> {
    return this.http.get<{declarations: string}>(`api:/function/declaration`);
  }

  getTriggers(scope?: string): Observable<any> {
    const params: any = {};
    params.scope = scope || "";
    return this.http.get(`api:/function/trigger`, {params: params});
  }

  create(fn: Function): Observable<Function> {
    return this.http
      .post<Function>(`api:/function/add`, fn)
      .pipe(tap(newFn => this.store.dispatch(new AddFunction({function: newFn}))));
  }

  update(fn: Function): Observable<Function> {
    return this.http
      .post<Function>(`api:/function/${fn._id}`, fn)
      .pipe(tap(() => this.store.dispatch(new UpsertFunction({function: fn}))));
  }

  delete(id: string): Observable<any> {
    return this.http
      .delete(`api:/function/${id}`)
      .pipe(tap(() => this.store.dispatch(new DeleteFunction({id}))));
  }
  exportData(functionIds: Array<string>): Observable<any> {
    return this.http.post(`api:/function/export`, functionIds, {responseType: "blob"});
  }

  importData(file: File): Observable<any> {
    return from(this.fileToBuffer(file)).pipe(
      flatMap(content => {
        const data = BSON.serialize({
          content: {
            data: new BSON.Binary(content),
            type: file.type
          }
        });
        const request = new HttpRequest("POST", `api:/function/import`, data.buffer, {
          reportProgress: true,
          headers: new HttpHeaders({"Content-Type": "application/bson"})
        });

        return this.http.request<Storage>(request);
      })
    );
  }

  private fileToBuffer(file: File): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = () => resolve(new Buffer(reader.result as ArrayBuffer));
      reader.onerror = error => reject(error);
    });
  }
}
