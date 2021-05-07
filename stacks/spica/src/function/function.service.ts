import {HttpClient} from "@angular/common/http";
import {Injectable, Inject} from "@angular/core";
import {select, Store} from "@ngrx/store";
import {Observable} from "rxjs";
import {map, switchMap, tap} from "rxjs/operators";
import {
  DeleteFunction,
  LoadFunctions,
  UpsertFunction,
  UpdateFunction
} from "./actions/function.actions";
import {Function, Information, Log, LogFilter, WEBSOCKET_INTERCEPTOR, Trigger} from "./interface";
import * as fromFunction from "./reducers/function.reducer";
import {PassportService} from "@spica-client/passport";
import {getWsObs} from "@spica-client/common";
import {examples} from "./statics/examples";

@Injectable({providedIn: "root"})
export class FunctionService {
  constructor(
    private http: HttpClient,
    private store: Store<fromFunction.State>,
    @Inject(WEBSOCKET_INTERCEPTOR) private wsInterceptor: string,
    private passport: PassportService
  ) {}

  private resetTimezoneOffset(date: Date) {
    return new Date(date.setMinutes(date.getMinutes() - date.getTimezoneOffset()));
  }

  listRepos(token: string) {
    //@TODO: put here more flexible code
    const url = "https://api.github.com/user";
    const headers = {Authorization: `token ${token}`};

    return this.http.get(url, {headers}).pipe(
      switchMap((res: any) =>
        this.http.get(`https://api.github.com/users/${res.login}/repos`, {headers}).pipe(
          map((branches: any[]) => {
            return {
              username: res.login,
              branches
            };
          })
        )
      )
    );
  }

  listBranches(repo: string, username: string, token: string) {
    //@TODO: put here more flexible code
    const url = `https://api.github.com/repos/${username}/${repo}/branches`;
    const headers = {Authorization: `token ${token}`};

    return this.http.get(url, {headers});
  }

  applyCommit(repo: string, branch: string, token: string, commit: string = "latest") {
    //@TODO: put here more flexible code
    const url = `api:/function/integrations/github/repos/${repo}/branches/${branch}/commits/${commit}`;
    return this.http.put(url, {token});
  }

  pushCommit(repo: string, branch: string, message: string) {
    //@TODO: put here more flexible code
    const url = `api:/function/integrations/github/repos/${repo}/branches/${branch}/commits`;
    return this.http.post(url, {message});
  }

  createRepo(repo: string, token: string) {
    const url = "api:/function/integrations/github/repos";
    return this.http.post(url, {repo, token});
  }

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

  getLogs(filter: LogFilter): Observable<Log[]> {
    let url = new URL(`${this.wsInterceptor}/function/logs`);

    if (filter.function.length > 0) {
      filter.function.forEach(fn => url.searchParams.append("functions", fn));
    }

    if (filter.begin instanceof Date) {
      url.searchParams.set("begin", this.resetTimezoneOffset(filter.begin).toISOString());
    }

    if (filter.end instanceof Date) {
      url.searchParams.set("end", this.resetTimezoneOffset(filter.end).toISOString());
    }

    if (!filter.sort) {
      filter.sort = {_id: -1};
    }
    url.searchParams.set("sort", JSON.stringify(filter.sort));

    url.searchParams.set("Authorization", this.passport.token);

    return getWsObs<Log>(url.toString(), filter.sort);
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
