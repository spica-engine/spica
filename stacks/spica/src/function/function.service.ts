import {HttpClient} from "@angular/common/http";
import {Injectable, Inject} from "@angular/core";
import {select, Store} from "@ngrx/store";
import {Observable, timer, of} from "rxjs";
import {webSocket} from "rxjs/webSocket";
import {map, tap, delayWhen, debounceTime} from "rxjs/operators";
import {
  DeleteFunction,
  LoadFunctions,
  UpsertFunction,
  UpdateFunction
} from "./actions/function.actions";
import {Function, Information, Log, LogFilter, WEBSOCKET_INTERCEPTOR} from "./interface";
import * as fromFunction from "./reducers/function.reducer";
import {PassportService} from "@spica-client/passport";

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

  getLogs(
    filter: LogFilter,
    limit: number = 10,
    skip: number = 0,
    sort: object = {_id: -1}
  ): Observable<Log[]> {
    let queryParams: string[] = [];

    if (filter.function.length > 0) {
      filter.function.forEach(fn => queryParams.push(`functions=${fn}`));
    }

    if (filter.begin instanceof Date) {
      queryParams.push(`begin=${this.resetTimezoneOffset(filter.begin).toISOString()}`);
    }

    if (filter.end instanceof Date) {
      queryParams.push(`end=${this.resetTimezoneOffset(filter.end).toISOString()}`);
    }

    queryParams.push(`limit=${limit}`);
    queryParams.push(`skip=${skip}`);
    queryParams.push(`sort=${JSON.stringify(sort)}`);

    queryParams.push(`Authorization=${this.passport.token}`);

    let mergedParams = "?" + queryParams.join("&");

    const data = new IterableSet<Log>();

    return webSocket<any>(`${this.wsInterceptor}/function/logs${mergedParams}`).pipe(
      tap(chunk => {
        switch (chunk.kind) {
          case ChunkKind.Initial:
          case ChunkKind.Insert:
          case ChunkKind.Replace:
          case ChunkKind.Update:
            data.set(chunk.document._id, chunk.document);
            break;
          case ChunkKind.Expunge:
          case ChunkKind.Delete:
            data.delete(chunk.document._id);
            break;
          case ChunkKind.Order:
            data.order(chunk.sequence);
            break;
        }
      }),
      delayWhen(chunk => {
        if (sort && chunk.kind == ChunkKind.Insert) {
          return timer(2);
        }
        return of(null);
      }),
      debounceTime(1),
      map(() => Array.from(data))
    );
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

export class IterableSet<T> implements Iterable<T> {
  ids = new Array<string>();
  dataset = new Map<string, T>();
  order(sequences: Sequence[]) {
    if (sequences) {
      const deletedIds = new Set<string>();
      for (const sequence of sequences) {
        switch (sequence.kind) {
          case SequenceKind.Substitute:
            this.ids[sequence.at] = sequence.with;
            break;
          case SequenceKind.Insert:
            this.ids.splice(sequence.at, 0, sequence.item);
            break;
          case SequenceKind.Delete:
            this.ids.splice(sequence.at, 1);
            deletedIds.add(sequence.item);
            break;
        }
      }
      // TODO: This should be handled at backend.
      deletedIds.forEach(id => {
        if (this.ids.indexOf(id) == -1) {
          this.dataset.delete(id);
        }
      });
    }
  }
  set(id: string, value: any) {
    if (!this.dataset.has(id)) {
      this.ids.push(id);
    }
    this.dataset.set(id, value);
  }
  delete(id: string, index?: number) {
    index = index || this.ids.indexOf(id);
    this.dataset.delete(id);
    this.ids.splice(index, 1);
  }
  [Symbol.iterator]() {
    let i = 0;
    return {
      next: () => {
        let value: T;
        if (i < this.ids.length) {
          value = this.dataset.get(this.ids[i]);
        }
        return {
          value: value,
          done: (i += 1) > this.ids.length
        };
      }
    } as Iterator<T>;
  }
}

export interface Sequence {
  kind: SequenceKind;
  item: string;
  at: number;
  with?: string;
}
export enum SequenceKind {
  Delete = 0,
  Substitute = 1,
  Insert = 2
}

export interface StreamChunk<T = any> {
  kind: ChunkKind;
  document?: T;
  sequence?: Sequence[];
}
export enum ChunkKind {
  Initial = 0,
  EndOfInitial = 1,
  Insert = 2,
  Delete = 3,
  Expunge = 4,
  Update = 5,
  Replace = 6,
  Order = 7
}
